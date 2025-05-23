import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/@types/x10Socket';
import { X10Player, X10Winner } from '@/@types/x10';
import { SOCKET_CONFIG } from '@/lib/config';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { GamePhase } from '@/contexts/X10RoomContext';

interface JoinRoomData {
  matchId: string;
  telegramId: number;
  username: string;
}

interface GamePhaseData {
  matchId: string;
  phase: GamePhase;
  players?: X10Player[];
  winners?: X10Winner[];
}

// Максимальное количество попыток повторного подключения
const MAX_RECONNECT_ATTEMPTS = 3;
// Задержка между повторными попытками в ms (начальная)
const INITIAL_RECONNECT_DELAY = 1000;

/**
 * Хук для управления WebSocket соединением X10
 * @param autoConnect - Автоматически подключаться (по умолчанию true для X10)
 */
export const useSocketX10 = (autoConnect: boolean = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { telegramUser } = useTelegramUser();

  // Очистка таймера переподключения
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    // Проверяем, нет ли уже активного соединения
    if (socketRef.current?.connected) {
      console.log('[X10Socket] 🔄 Соединение уже установлено');
      setIsConnected(true);
      return;
    }

    try {
      // Инициализируем сокет только если его нет
      if (!socketRef.current) {
        socketRef.current = io({
          transports: ['websocket', 'polling'],
          query: { gameType: 'x10' }
        });

        // Настраиваем обработчики только при первой инициализации
        socketRef.current.on('connect', () => {
          console.log('[X10Socket] ✅ Подключено');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
        });

        socketRef.current.on('disconnect', () => {
          console.log('[X10Socket] ❌ Отключено');
          setIsConnected(false);
        });

        // Обработка heartbeat
        socketRef.current.on('heartbeat', () => {
          socketRef.current?.emit('heartbeat_ack');
        });
      }

      // Подключаемся только если сокет не подключен
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
    } catch (error) {
      console.error('[X10Socket] ❌ Ошибка инициализации:', error);
    }
  }, []);

  // Функция подключения к комнате матча с улучшенной обработкой ошибок
  const joinX10Room = useCallback(async (data: JoinRoomData) => {
    console.log(`[X10Socket] 🚪 Подключение к комнате: ${data.matchId}`);
    
    // Проверяем существующее соединение
    if (socketRef.current) {
      // Если сокет уже подключен, просто используем его
      if (socketRef.current.connected) {
        console.log('[X10Socket] ✓ Используем существующее подключение к сокету');
      } 
      // Если сокет создан, но не подключен - подключаем
      else {
        console.log('[X10Socket] 🔄 Сокет не подключен, подключаемся...');
        try {
          await connect();
          // Задержка для стабилизации подключения
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('[X10Socket] ❌ Не удалось подключить сокет:', error);
          throw error;
        }
      }
    } 
    // Если сокет не создан, создаем и подключаем
    else {
      console.log('[X10Socket] 🔌 Сокет не создан, инициализируем...');
      try {
        await connect();
        // Задержка для стабилизации подключения
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('[X10Socket] ❌ Не удалось создать сокет:', error);
        throw error;
      }
    }
    
    // Проверяем подключение после всех попыток
    if (!socketRef.current?.connected) {
      console.error('[X10Socket] ⚠️ Сокет всё еще не подключен после попыток!');
      
      // Последняя попытка соединения
      try {
        console.log('[X10Socket] 🔄 Последняя попытка подключения сокета...');
        await connect();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (retryError) {
        console.error('[X10Socket] ❌ Повторное подключение не удалось:', retryError);
        throw new Error('Не удалось подключиться к сокету перед входом в комнату');
      }
    }
    
    // Увеличиваем таймаут на подключение к комнате
    return new Promise<void>((resolve, reject) => {
      // Двойной таймаут: один для ожидания ответа, второй для общего времени операции
      const responseTimeoutId = setTimeout(() => {
        console.error('[X10Socket] ⏱️ Превышено время ожидания ответа от сервера');
        reject(new Error('Превышено время ожидания ответа от сервера'));
      }, 10000); // Увеличиваем с 5000 до 10000 мс
      
      // Общий таймаут операции
      const operationTimeoutId = setTimeout(() => {
        console.error('[X10Socket] ⏱️ Превышено общее время операции подключения');
        clearTimeout(responseTimeoutId);
        
        // Пробуем переподключиться к сокету (крайняя мера)
        if (socketRef.current) {
          console.log('[X10Socket] 🔄 Пробуем переподключиться к сокету...');
          socketRef.current.disconnect();
          setTimeout(() => socketRef.current?.connect(), 500);
        }
        
        reject(new Error('Превышено общее время операции подключения'));
      }, 15000); // Увеличиваем с 10000 до 15000 мс
      
      try {
        console.log('[X10Socket] 📡 Отправляем запрос на подключение к комнате:', data.matchId);
        
        // Проверка на наличие сокета перед отправкой
        if (!socketRef.current) {
          clearTimeout(responseTimeoutId);
          clearTimeout(operationTimeoutId);
          reject(new Error('Сокет не инициализирован перед отправкой запроса'));
          return;
        }
        
        // Обработка возможного отсутствия emit метода
        if (typeof socketRef.current.emit !== 'function') {
          clearTimeout(responseTimeoutId);
          clearTimeout(operationTimeoutId);
          reject(new Error('Метод emit не найден в объекте сокета'));
          return;
        }
        
        // Безопасная отправка запроса
        socketRef.current.emit('joinX10Room', data, (response) => {
          // Очищаем таймауты при получении ответа
          clearTimeout(responseTimeoutId);
          clearTimeout(operationTimeoutId);
          
          if (response && response.success) {
            console.log('[X10] ✅ ПОДКЛЮЧЕНИЕ: Успешно подключились к комнате матча');
            resolve();
          } else {
            const errorMsg = response && response.error ? response.error : 'Неизвестная ошибка при подключении к комнате';
            console.error('[X10Socket] ❌ Не удалось подключиться к комнате:', errorMsg);
            reject(new Error(errorMsg));
          }
        });
      } catch (error) {
        // Очищаем таймауты при ошибке
        clearTimeout(responseTimeoutId);
        clearTimeout(operationTimeoutId);
        console.error('[X10Socket] 💥 Критическая ошибка при отправке запроса:', error);
        reject(error);
      }
    });
  }, [connect]);

  // Отключение сокета с очисткой ресурсов
  const disconnect = useCallback(() => {
    clearReconnectTimer(); // Очищаем таймер переподключения
    
    if (socketRef.current) {
      console.log('[X10Socket] 🔌 Отключаемся от сокета');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [clearReconnectTimer]);

  // Обработчики событий с улучшенной обработкой ошибок
  const onGameStarted = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.warn('[X10Socket] ⚠️ Невозможно добавить слушатель gameStarted: сокет не инициализирован');
      return () => {};
    }
    
    // Создаем обертку для обработки ошибок в коллбэке
    const safeCallback = (data: any) => {
      try {
        console.log('[X10Socket] 🎮 Получено событие gameStarted:', data);
        callback(data);
      } catch (error) {
        console.error('[X10Socket] ❌ Ошибка в обработчике gameStarted:', error);
      }
    };
    
    console.log('[X10Socket] 👂 Добавляем слушатель gameStarted');
    socketRef.current.on('gameStarted', safeCallback);
    
    return () => {
      console.log('[X10Socket] 🔕 Удаляем слушатель gameStarted');
      socketRef.current?.off('gameStarted', safeCallback);
    };
  }, []);

  const onGamePhase = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.warn('[X10Socket] ⚠️ Невозможно добавить слушатель gamePhase: сокет не инициализирован');
      return () => {};
    }
    
    // Создаем обертку для обработки ошибок в коллбэке
    const safeCallback = (data: any) => {
      try {
        console.log('[X10Socket] 🎯 Получено событие gamePhase:', data);
        callback(data);
      } catch (error) {
        console.error('[X10Socket] ❌ Ошибка в обработчике gamePhase:', error);
      }
    };
    
    console.log('[X10Socket] 👂 Добавляем слушатель gamePhase');
    socketRef.current.on('gamePhase', safeCallback);
    
    return () => {
      console.log('[X10Socket] 🔕 Удаляем слушатель gamePhase');
      socketRef.current?.off('gamePhase', safeCallback);
    };
  }, []);

  // Подключаемся только при монтировании, если autoConnect = true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // При размонтировании только отключаем обработчики, но не закрываем соединение
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('heartbeat');
      }
    };
  }, [autoConnect, connect]);

  return {
    isConnected,
    lastError,
    connect,
    disconnect,
    joinX10Room,
    onGameStarted,
    onGamePhase
  };
}; 