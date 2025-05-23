'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket as SocketIOClient } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '@/@types/socket';
import { useUser } from '@/contexts/UserContext';

// Для отладки
const debug = (message: string, ...args: any[]) => {
  console.log(`[Socket] ${message}`, ...args);
};

/**
 * Хук для управления WebSocket-соединением с сервером игры.
 * Обеспечивает автоматическое подключение, обработку статусов и автоматические переподключения.
 * 
 * @param autoConnect - Автоматически подключаться при монтировании компонента
 * @returns {UseSocketReturnType} - Объект с методами и состояниями для работы с сокетом
 */
export function useSocket(autoConnect: boolean = true) {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<SocketIOClient | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      console.log('[Socket] 🔌 Соединение уже установлено');
      return;
    }

    if (!user?.id) {
      console.error('[Socket] ❌ Пользователь не авторизован');
      return;
    }

    const socketUrl = window.location.origin;
    console.log('[Socket] 🔄 Подключение к:', socketUrl);
    
    socketRef.current = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket'],
      query: { telegramId: user.id.toString() }
    });

    socketRef.current.on('connect', () => {
      console.log('[Socket] ✅ Подключено');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    });

    socketRef.current.on('disconnect', () => {
      console.log('[Socket] ❌ Отключено');
      setIsConnected(false);
    });

    socketRef.current.on('error', (error: string) => {
      console.error('[Socket] ⚠️ Ошибка:', error);
      setIsConnected(false);
    });
  }, [user]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  const emit = useCallback(<T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit(event, ...args);
    return true;
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, callback);
    return () => socketRef.current?.off(event, callback);
  }, []);

  useEffect(() => {
    if (user?.id && autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [connect, disconnect, user, autoConnect]);

  return {
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    socket: socketRef.current
  };
} 