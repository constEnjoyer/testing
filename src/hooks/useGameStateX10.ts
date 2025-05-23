import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useStorage, STORAGE_KEYS } from '@/hooks/useStorage';
import { GamePhase, GAME_TIMINGS } from '@/contexts/X10RoomContext';
import { X10Player, X10Winner } from '@/@types/x10';

export type GameStatusX10 = 'idle' | 'waiting' | 'playing' | 'completed';

export interface X10Match {
  matchId: string;
  players: X10Player[];
  winners?: X10Winner[];
  createdAt?: string;
  status: string;
}

export interface JoinRoomParams {
  matchId: string;
  telegramId: number;
  username: string;
}

export interface GameStateX10 {
  phase: GamePhase;
  matchId: string | null;
  players: X10Player[];
  winners: X10Winner[];
  waitingStartTime: number | null;
  animationStartTime: number | null;
}

export interface UseGameStateX10ReturnType {
  gameState: GameStateX10;
  isWaiting: boolean;
  findPlayers: (tickets: number) => Promise<void>;
  cancelWaiting: () => Promise<void>;
  updateGameState: (state: Partial<GameStateX10>) => void;
  resetGame: () => void;
  completeGame: (matchId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  timings: typeof GAME_TIMINGS;
  handleSocketEvents: (telegramId?: number) => void;
  updateUserBalance: () => Promise<any>;
}

const initialGameState: GameStateX10 = {
  phase: 'idle',
  matchId: null,
  players: [],
  winners: [],
  waitingStartTime: null,
  animationStartTime: null
};

/**
 * Хук для управления состоянием игры X10
 * @param joinX10Room - Функция для подключения к комнате матча
 * @returns Объект с методами и состояниями для управления игрой X10
 */
export function useGameStateX10(
  joinX10Room?: (data: JoinRoomParams) => Promise<void>
): UseGameStateX10ReturnType {
  const { user } = useUser();
  const { telegramUser } = useTelegramUser();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Получаем сохраненное состояние игры из localStorage
  const { 
    value: savedGameState, 
    setValue: setSavedGameState 
  } = useStorage<GameStateX10>(STORAGE_KEYS.GAME_STATE_X10);
  
  // Инициализация состояния игры
  const [gameState, setGameState] = useState<GameStateX10>(() => {
    console.log('[useGameStateX10] Инициализация состояния игры:', savedGameState);
    // Если был в ожидании - сбрасываем состояние
    return savedGameState?.phase === 'waiting' ? initialGameState : savedGameState || initialGameState;
  });
  
  // Устанавливаем isWaiting в зависимости от состояния игры
  const isWaiting = gameState.phase === 'waiting';
  
  // Обновление состояния игры с синхронизацией в хранилище
  const updateGameState = useCallback((newState: Partial<GameStateX10>) => {
    setGameState(prev => {
      const updated = { ...prev, ...newState };
      setSavedGameState(updated);
      return updated;
    });
  }, [setSavedGameState]);
  
  // Обновление баланса пользователя с повторными попытками
  const updateUserBalance = useCallback(async () => {
    if (!telegramUser?.id) return;
    
    const maxRetries = 3;
    let currentTry = 0;
    
    const tryUpdateBalance = async (): Promise<any> => {
      try {
        console.log(`[useGameStateX10] Попытка ${currentTry + 1}/${maxRetries} обновления баланса для:`, telegramUser.id);
        const response = await fetch(`/api/user-data?telegramId=${telegramUser.id}&_cache=${Date.now()}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            console.log('[useGameStateX10] ✅ Баланс успешно обновлен:', data.data);
            return data.data;
          }
        }
        throw new Error('Failed to update balance');
      } catch (error) {
        console.error(`[useGameStateX10] ❌ Ошибка при обновлении баланса (попытка ${currentTry + 1}):`, error);
        
        if (currentTry < maxRetries - 1) {
          currentTry++;
          // Экспоненциальная задержка между попытками
          const delay = Math.min(1000 * Math.pow(2, currentTry), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return tryUpdateBalance();
        }
        throw error;
      }
    };
    
    return tryUpdateBalance();
  }, [telegramUser?.id]);
  
  // Присоединение к комнате матча для получения событий
  const joinMatchRoom = useCallback(async (matchId: string) => {
    if (!telegramUser?.id || !telegramUser?.username) {
      console.error('[useGameStateX10] Нет данных пользователя для подключения к комнате');
      return;
    }
    
    try {
      console.log('[useGameStateX10] Подключаемся к комнате:', matchId);
      
      // Используем переданную функцию для подключения к комнате
      if (joinX10Room) {
        await joinX10Room({
          matchId,
          telegramId: telegramUser.id,
          username: telegramUser.username
        });
        console.log('[useGameStateX10] Успешно подключились к комнате:', matchId);
      } else {
        console.warn('[useGameStateX10] Функция joinX10Room не предоставлена');
      }
    } catch (error) {
      console.error('[useGameStateX10] Ошибка при подключении к комнате:', error);
    }
  }, [telegramUser?.id, telegramUser?.username, joinX10Room]);
  
  // Проверка активного матча при загрузке страницы
  useEffect(() => {
    const checkActiveMatch = async () => {
      if (!telegramUser?.id) return;
      
      // Если мы уже в игре, не нужно проверять
      if (gameState.phase !== 'idle') return;
      
      try {
        console.log('[X10] 🚀 ПРОВЕРКА: Ищем активный матч при загрузке страницы...');
        const response = await fetch(`/api/match/x10/game?telegramId=${telegramUser.id}`);
        
        if (response.ok) {
          const responseData = await response.json();
          console.log('[X10] 📊 Получен ответ от API:', responseData);
          
          // ИСПРАВЛЕНО: Проверяем что пользователь в матче по правильной структуре ответа
          if (responseData.success && responseData.data && responseData.data.status === 'in_match') {
            console.log('[X10] 🎮 НАЙДЕНО: Активный матч обнаружен:', responseData.data);
            
            // Восстанавливаем состояние игры
            updateGameState({
              phase: 'preparing', // Начинаем с первой фазы
              matchId: responseData.data.matchId,
              players: responseData.data.players || [],
              animationStartTime: Date.now() // Устанавливаем текущее время
            });
            
            // Подключаемся к комнате матча
            await joinMatchRoom(responseData.data.matchId);
            
            console.log('[X10] 🔌 УСПЕХ: Восстановлено подключение к комнате:', responseData.data.matchId);
            
            // Обновляем баланс пользователя
            await updateUserBalance();
          } else {
            console.log('[X10] ℹ️ Активных матчей не найдено');
          }
        }
      } catch (error) {
        console.error('[X10] ❌ ОШИБКА: Проблема при проверке активного матча:', error);
      }
    };
    
    checkActiveMatch();
  }, [telegramUser?.id, gameState.phase, updateGameState, joinMatchRoom, updateUserBalance]);
  
  // Поиск игроков - вызов API для создания матча
  const findPlayers = useCallback(async (tickets: number) => {
    if (!telegramUser?.id || !telegramUser?.username) {
      setError('Необходимо авторизоваться для начала игры');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('[useGameStateX10] Создаем матч для пользователя:', telegramUser.id);

      // Обновляем состояние игры на "waiting"
      updateGameState({ 
        phase: 'waiting',
        waitingStartTime: Date.now() 
      });
      
      // Создаем матч через API
      const response = await fetch('/api/match/x10/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: telegramUser.id,
          username: telegramUser.username,
          tickets: tickets
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка при создании матча: ${response.status}`);
      }

      const data = await response.json();
      console.log('[useGameStateX10] Ответ от сервера при создании матча:', data);
      
      if (data.success && data.matchId) {
        console.log('[useGameStateX10] Матч успешно создан:', data.matchId);
        
        // Если матч сразу в состоянии игры, переходим к анимации
        if (data.status === 'playing') {
          console.log('[useGameStateX10] Матч в состоянии игры, переходим к анимации');
          
          updateGameState({
            phase: 'preparing',
            matchId: data.matchId,
            players: data.players || [],
            animationStartTime: Date.now()
          });
          
          // Присоединяемся к комнате для получения событий
          await joinMatchRoom(data.matchId);
          
          // Обновляем баланс пользователя
          await updateUserBalance();
        } else {
          // Иначе обновляем ID матча и остаемся в состоянии ожидания
          console.log('[useGameStateX10] Матч в состоянии ожидания');
          updateGameState({
            matchId: data.matchId,
            players: data.players || [],
          });
        }
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[useGameStateX10] Ошибка при поиске игроков:', error);
      setError(`Ошибка при поиске игроков: ${error instanceof Error ? error.message : String(error)}`);
      
      // Возвращаем в исходное состояние
      updateGameState(initialGameState);
    } finally {
      setIsLoading(false);
    }
  }, [telegramUser, updateGameState, joinMatchRoom, updateUserBalance]);
  
  // Отмена ожидания
  const cancelWaiting = useCallback(async () => {
    if (!telegramUser?.id) {
      console.error('[useGameStateX10] Нет ID пользователя для отмены');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[useGameStateX10] Отменяем поиск для пользователя:', telegramUser.id);
      
      const response = await fetch('/api/match/x10/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: telegramUser.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка при отмене поиска: ${response.status}`);
      }

      const data = await response.json();
      console.log('[useGameStateX10] Ответ от сервера при отмене поиска:', data);
      
      if (data.success) {
        updateGameState(initialGameState);
        localStorage.removeItem(STORAGE_KEYS.GAME_STATE_X10);
      }
    } catch (error) {
      console.error('[useGameStateX10] Ошибка при отмене поиска:', error);
      setError(`Ошибка при отмене поиска: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [telegramUser, updateGameState]);
  
  // Сброс состояния игры
  const resetGame = useCallback(() => {
    console.log('[useGameStateX10] Сброс состояния игры');
    console.log('[useGameStateX10] Предыдущее состояние:', gameState);
    
    updateGameState(initialGameState);
    setError(null);
    
    console.log('[useGameStateX10] Состояние сброшено');
  }, [updateGameState, gameState]);
  
  // Завершение игры с гарантированным обновлением баланса
  const completeGame = useCallback(async (matchId: string) => {
    if (!telegramUser?.id) {
      console.error('[useGameStateX10] ❌ Нет ID пользователя Telegram');
      return;
    }

    // Защита от повторного вызова
    if (gameState.phase === 'result') {
      console.log('[useGameStateX10] ⚠️ Игра уже в фазе результатов');
      return;
    }

    try {
      console.log('[useGameStateX10] 🎮 Завершаем игру:', matchId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/match/x10/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          telegramId: telegramUser.id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const winners = Array.isArray(data.winners) ? data.winners : [];
        console.log('[useGameStateX10] 🏆 Победители:', winners);
        
        // Сразу обновляем состояние на результат
        updateGameState({
          phase: 'result',
          winners: winners
        });

        // Обновляем баланс один раз
        try {
          await updateUserBalance();
          console.log('[useGameStateX10] ✅ Баланс обновлен');
        } catch (error) {
          console.error('[useGameStateX10] ❌ Ошибка обновления баланса:', error);
        }

        return;
      } else {
        throw new Error(data.error || 'Ошибка при получении результатов');
      }
    } catch (error) {
      console.error(`[useGameStateX10] ❌ Ошибка при завершении игры:`, error);
      
      // В случае ошибки показываем пустые результаты
      updateGameState({
        phase: 'result',
        winners: []
      });

      // Все равно пытаемся обновить баланс
      updateUserBalance().catch(console.error);
    }
  }, [telegramUser?.id, updateGameState, updateUserBalance, gameState.phase]);
  
  // Проверка статуса матча (если находимся в состоянии ожидания)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isWaiting && telegramUser?.id) {
      // Функция для проверки статуса
      const checkMatchStatus = async () => {
        try {
          console.log('[useGameStateX10] Проверка статуса для пользователя:', telegramUser.id);
          
          const response = await fetch(`/api/match/x10/game?telegramId=${telegramUser.id}`);
          
          if (!response.ok) {
            throw new Error(`Ошибка при проверке статуса: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[useGameStateX10] Ответ от сервера при проверке статуса:', data);
          
          // ИСПРАВЛЕНО: Проверяем правильную структуру ответа
          if (data.success && data.data && data.data.status === 'in_match') {
            console.log('[X10] 🎮 МАТЧ НАЙДЕН: Активный матч с ID:', data.data.matchId);
            
            updateGameState({
              phase: 'preparing',
              matchId: data.data.matchId,
              players: data.data.players || [],
              animationStartTime: Date.now()
            });
            
            // Подключаемся к комнате матча, если еще не подключены
            if (data.data.matchId && gameState.matchId !== data.data.matchId) {
              await joinMatchRoom(data.data.matchId);
              console.log('[X10] 🔌 ПОДКЛЮЧЕНИЕ: Успешно подключились к комнате матча');
            }
            
            // Обновляем баланс пользователя
            await updateUserBalance();
          }
        } catch (error) {
          console.error('[useGameStateX10] Ошибка при проверке статуса матча:', error);
        }
      };
      
      // Проверяем сразу при входе в режим ожидания
      checkMatchStatus();
      
      // Устанавливаем интервал для периодической проверки
      console.log('[useGameStateX10] Запускаем интервал проверки статуса каждые 3 секунды');
      intervalId = setInterval(checkMatchStatus, 3000); // Каждые 3 секунды
    }
    
    return () => {
      if (intervalId) {
        console.log('[useGameStateX10] Очищаем интервал проверки статуса');
        clearInterval(intervalId);
      }
    };
  }, [isWaiting, telegramUser?.id, gameState.matchId, updateGameState, joinMatchRoom, updateUserBalance]);

  // Управление анимационными фазами на основе таймингов
  useEffect(() => {
    if (!gameState.animationStartTime || 
        gameState.phase === 'idle' || 
        gameState.phase === 'waiting' || 
        gameState.phase === 'completed') {
      return;
    }
    
    console.log(`[useGameStateX10] 📊 Текущая фаза: ${gameState.phase}`);
    
    let nextPhase: GamePhase | null = null;
    let timeoutDuration = 0;
    
    switch (gameState.phase) {
      case 'preparing':
        nextPhase = 'merging';
        timeoutDuration = GAME_TIMINGS.PREPARING;
        break;
      case 'merging':
        nextPhase = 'wheel_appear';
        timeoutDuration = GAME_TIMINGS.MERGING;
        break;
      case 'wheel_appear':
        nextPhase = 'wheel_spin';
        timeoutDuration = GAME_TIMINGS.WHEEL_APPEAR;
        break;
      case 'wheel_spin':
        nextPhase = 'wheel_disappear';
        timeoutDuration = GAME_TIMINGS.WHEEL_SPIN;
        break;
      case 'wheel_disappear':
        if (gameState.matchId) {
          // Увеличиваем общую задержку для корректного тайминга
          timeoutDuration = GAME_TIMINGS.WHEEL_DISAPPEAR + GAME_TIMINGS.RESULT_DELAY; // 2000 + 1000 = 3000мс
          const timer = setTimeout(() => {
            console.log(`[useGameStateX10] 🏁 Запрашиваем результаты матча: ${gameState.matchId}`);
            completeGame(gameState.matchId!);
          }, timeoutDuration);
          
          return () => clearTimeout(timer);
        }
        break;
      case 'result':
        // Убираем автоматический переход к completed
        // Теперь это будет делать модальное окно при закрытии
        break;
    }
    
    // Если определена следующая фаза, устанавливаем таймер
    if (nextPhase) {
      console.log(`[useGameStateX10] ⏱️ Установка таймера на ${timeoutDuration}ms для перехода к ${nextPhase}`);
      
      // Время, прошедшее с начала текущей фазы
      const elapsedSincePhaseStart = Date.now() - gameState.animationStartTime;
      
      // Если уже прошло достаточно времени, переходим сразу
      if (elapsedSincePhaseStart >= timeoutDuration) {
        console.log(`[useGameStateX10] ⚡ Немедленный переход к фазе ${nextPhase} (прошло ${elapsedSincePhaseStart}ms)`);
        updateGameState({ 
          phase: nextPhase,
          animationStartTime: Date.now()
        });
        return;
      }
      
      // Иначе ждем оставшееся время
      const remainingTime = Math.max(0, timeoutDuration - elapsedSincePhaseStart);
      console.log(`[useGameStateX10] ⏳ Ожидание ${remainingTime}ms до перехода в ${nextPhase}`);
      
      const phaseTimer = setTimeout(() => {
        console.log(`[useGameStateX10] 🔄 Переход к фазе: ${nextPhase}`);
        updateGameState({ 
          phase: nextPhase!,
          animationStartTime: Date.now()
        });
      }, remainingTime);
      
      return () => clearTimeout(phaseTimer);
    }
    
  }, [gameState.phase, gameState.matchId, gameState.animationStartTime, updateGameState, completeGame]);

  // Механизм автоматического восстановления при критических ошибках
  useEffect(() => {
    if (!error) return;
    
    console.log('[useGameStateX10] 🔍 Проверка на критические ошибки:', error);
    
    // Если у нас ошибка таймаута и мы не в конечном состоянии
    if ((error.includes('504') || error.includes('timeout')) && 
        gameState.phase !== 'idle' && 
        gameState.phase !== 'completed') {
      
      console.log('[useGameStateX10] ⚠️ Обнаружена критическая ошибка таймаута, запуск процесса восстановления');
      
      // Устанавливаем таймер для автоматического восстановления через 10 секунд
      const recoveryTimer = setTimeout(() => {
        console.log('[useGameStateX10] 🔄 Автоматическое восстановление после ошибки таймаута');
        
        // Сначала устанавливаем завершенное состояние
        updateGameState({
          phase: 'completed',
          winners: []
        });
        
        // Затем через короткое время полностью сбрасываем состояние
        setTimeout(() => {
          resetGame();
          console.log('[useGameStateX10] ✅ Игра сброшена, можно начать снова');
        }, 2000);
      }, 10000); // 10 секунд для чтения сообщения об ошибке
      
      return () => clearTimeout(recoveryTimer);
    }
  }, [error, gameState.phase, updateGameState, resetGame]);

  // Обработчик событий сокета
  const handleSocketEvents = useCallback((telegramId?: number) => {
    if (!telegramId) {
      console.warn('[useGameStateX10] ⚠️ Нет telegramId для настройки обработчиков сокет-событий');
      return;
    }
    
    console.log('[useGameStateX10] 🔌 Настраиваем обработчики сокет-событий для пользователя:', telegramId);
    
    // ВАЖНО: В этой функции должны быть определены все необходимые события для X10
    // В зависимости от архитектуры вашего socket-хука, подписки на события 
    // происходят либо тут, либо в самом socket-хуке
    
    // Пример (предполагая, что у вас есть внешние обработчики):
    // onGamePhase((data) => {
    //   console.log('[useGameStateX10] Получено событие gamePhase:', data);
    //   
    //   if (data && data.phase) {
    //     updateGameState({
    //       phase: data.phase,
    //       ...(data.winners ? { winners: data.winners } : {})
    //     });
    //   }
    // });
    
    // Так как обработчики теперь перенесены в хук, уведомляем об этом
    console.log('[useGameStateX10] ✅ Обработчики сокет-событий успешно настроены');
  }, []);

  return {
    gameState,
    isWaiting,
    findPlayers,
    cancelWaiting,
    updateGameState,
    resetGame,
    completeGame,
    error,
    isLoading,
    timings: GAME_TIMINGS,
    handleSocketEvents,
    updateUserBalance
  };
} 