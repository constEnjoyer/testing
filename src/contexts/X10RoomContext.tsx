'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useSocketX10 } from '@/hooks/useSocketX10';
import { X10Player, X10Winner } from '@/@types/x10';
import { useTelegramUser } from '@/hooks/useTelegramUser';

// Константы для таймингов фаз игры
export const GAME_TIMINGS = {
  PREPARING: 5000,    // 5 секунд на подготовку
  MERGING: 7500,      // 7.5 секунд на анимацию слияния
  WHEEL_APPEAR: 4000, // 4 секунды на появление колеса
  WHEEL_SPIN: 7000,   // 7 секунд на вращение
  WHEEL_DISAPPEAR: 2000, // 2 секунды на исчезновение
  RESULT_DELAY: 1000,  // 1 секунда задержки перед показом результата
} as const;

// Определяем тип устройства
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Обновляем константы для разных устройств
const TIMINGS = {
  DESKTOP: {
    UNLOCK_DELAY: 100,
    SOUND_DELAY: 200,
    CLEANUP_DELAY: 100
  },
  MOBILE: {
    UNLOCK_DELAY: 300,
    SOUND_DELAY: 400,
    CLEANUP_DELAY: 200
  }
} as const;

// Выбираем нужные тайминги в зависимости от устройства
const DEVICE_TIMINGS = isMobile ? TIMINGS.MOBILE : TIMINGS.DESKTOP;

export type GamePhase = 
  | 'idle'           // Начальное состояние
  | 'waiting'        // Ожидание матча
  | 'preparing'      // 5-секундный countdown
  | 'merging'        // Анимация объединения
  | 'wheel_appear'   // Появление колеса
  | 'wheel_spin'     // Вращение колеса
  | 'wheel_disappear' // Исчезновение колеса
  | 'result'         // Показ результатов
  | 'completed';     // Игра завершена

interface GameState {
  phase: GamePhase;
  matchId: string | null;
  players: X10Player[];
  winners?: X10Winner[];
}

interface X10RoomContextState {
  gameState: GameState;
  position?: number;
  error: string | null;
}

interface X10RoomContextValue extends X10RoomContextState {
  updateGameState: (newState: Partial<GameState>) => void;
  resetRoom: () => void;
  setError: (error: string | null) => void;
}

const initialGameState: GameState = {
  phase: 'idle',
  matchId: null,
  players: [],
};

const initialState: X10RoomContextState = {
  gameState: initialGameState,
  error: null
};

const X10RoomContext = createContext<X10RoomContextValue | null>(null);

export const useX10Room = () => {
  const context = useContext(X10RoomContext);
  if (!context) {
    throw new Error('useX10Room must be used within X10RoomProvider');
  }
  return context;
};

interface X10RoomProviderProps {
  children: ReactNode;
}

export const X10RoomProvider: React.FC<X10RoomProviderProps> = ({ children }) => {
  const [state, setState] = useState<X10RoomContextState>(initialState);
  const { telegramUser } = useTelegramUser();
  const { isConnected, onGameStarted } = useSocketX10();

  const updateGameState = useCallback((newState: Partial<GameState>) => {
    setState(prev => ({
      ...prev,
      gameState: {
        ...prev.gameState,
        ...newState
      }
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const resetRoom = useCallback(() => {
    setState(initialState);
  }, []);

  // WebSocket события - только для синхронизации анимации
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = onGameStarted((data) => {
      console.log('[X10Room] Получено событие gameStarted:', data);
      updateGameState({
        phase: 'preparing',
        matchId: data.matchId,
        players: data.players
      });
    });

    return cleanup;
  }, [isConnected, onGameStarted, updateGameState]);

  const value: X10RoomContextValue = {
    ...state,
    updateGameState,
    resetRoom,
    setError,
  };

  return (
    <X10RoomContext.Provider value={value}>
      {children}
    </X10RoomContext.Provider>
  );
}; 