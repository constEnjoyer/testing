'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStorage, STORAGE_KEYS } from './useStorage';
import { useUser } from '@/contexts/UserContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { 
  GamePhase, 
  GameStatus, 
  Match as GameMatch, 
  GameResult,
  GameResultInfo
} from '@/@types/game';

// Интерфейс состояния игры
export interface GameState {
  status: GameStatus;
  phase: GamePhase;
  match: GameMatch | null;
  result: GameResult | null;
  countdown: number;
  waitingStartTime: number | null;
  chancePhaseCompleted: boolean;
  error: string | null;
  lastUpdated: Date;
}

// Интерфейс хука состояния игры
export interface UseGameStateReturnType {
  gameState: GameState;
  isWaiting: boolean;
  isPlaying: boolean;
  findOpponent: (tickets: number) => Promise<void>;
  cancelWaiting: () => Promise<void>;
  setOpponent: (opponent: { id: number; name: string }) => void;
  updateGameState: (state: Partial<GameState>) => void;
  completeGame: (result: GameResult) => Promise<void>;
  resetGame: () => void;
  error: string | null;
}

/**
 * Хук для управления состоянием игры
 * @returns Объект с методами и состояниями для управления игрой
 */
export function useGameState(): UseGameStateReturnType {
  const { user } = useUser();
  const { telegramUser } = useTelegramUser();
  const [error, setError] = useState<string | null>(null);
  
  // Получаем сохраненное состояние игры из localStorage
  const { 
    value: savedGameState, 
    setValue: setSavedGameState 
  } = useStorage<GameState>(STORAGE_KEYS.GAME_STATE);
  
  // Инициализация состояния игры
  const [gameState, setGameState] = useState<GameState>(() => {
    console.log('[useGameState] Инициализация состояния игры:', savedGameState);
    const initialState: GameState = {
      status: 'idle',
      phase: GamePhase.IDLE,
      match: null,
      result: null,
      countdown: 0,
      waitingStartTime: null,
      chancePhaseCompleted: false,
      error: null,
      lastUpdated: new Date()
    };
    
    return savedGameState?.status === 'waiting' ? initialState : savedGameState || initialState;
  });
  
  useEffect(() => {
    if (gameState.status !== 'idle') {
      console.log('[useGameState] Состояние игры не idle при инициализации:', gameState.status);
    }
  }, [gameState]);
  
  // Устанавливаем состояния на основе фазы
  const isWaiting = gameState.phase === GamePhase.WAITING;
  const isPlaying = gameState.phase === GamePhase.PLAYING;
  
  // Обновление состояния игры с синхронизацией в хранилище
  const updateGameState = useCallback((newState: Partial<GameState>) => {
    setGameState(prev => {
      const updated = { 
        ...prev, 
        ...newState,
        lastUpdated: new Date()
      };
      setSavedGameState(updated);
      return updated;
    });
  }, [setSavedGameState]);
  
  // Поиск соперника
  const findOpponent = useCallback(async (ticketsAmount: number) => {
    console.log('[useGameState] Поиск оппонента. Билеты:', ticketsAmount, 'Пользователь:', telegramUser?.id);
    if (!user && !telegramUser?.id) {
      setError('Пользователь не авторизован');
      return;
    }

    try {
      setError(null);
      
      // Проверяем, что нет активной игры
      if (gameState.phase !== GamePhase.IDLE) {
        console.log('[useGameState] Сбрасываем старое состояние перед поиском');
        updateGameState({
          status: 'idle',
          phase: GamePhase.IDLE,
          match: null,
          result: null,
          countdown: 0,
          waitingStartTime: null,
          chancePhaseCompleted: false,
        });
      }
      
      // Обновляем состояние - начинаем ожидание
      console.log('[useGameState] Переходим в состояние waiting');
      updateGameState({
        status: 'waiting',
        phase: GamePhase.WAITING,
        waitingStartTime: Date.now(),
      });
      
      // Отправляем запрос на сервер для поиска соперника
      console.log('[useGameState] Отправляем запрос на сервер');
      const response = await fetch('/api/match/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: telegramUser?.id,
          ticketsAmount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка при поиске соперника: ${response.status}`);
      }

      const data = await response.json();
      console.log('[useGameState] Ответ от сервера при создании матча:', data);

      if (!data.success) {
        throw new Error(data.error || 'Ошибка при поиске соперника');
      }
    } catch (error) {
      console.error('[useGameState] Ошибка при поиске соперника:', error);
      setError(`Ошибка при поиске соперника: ${error instanceof Error ? error.message : String(error)}`);
      
      // Возвращаем в исходное состояние
      updateGameState({
        status: 'idle',
        phase: GamePhase.IDLE,
        waitingStartTime: null,
        chancePhaseCompleted: false,
      });
    }
  }, [user, telegramUser, gameState.phase, updateGameState]);
  
  // Отмена ожидания соперника
  const cancelWaiting = useCallback(async () => {
    if (!telegramUser?.id) {
      console.error('[useGameState] Нет ID пользователя для отмены');
      return;
    }

    try {
      const response = await fetch('/api/match/cancel', {
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
      if (data.success) {
        updateGameState({
          status: 'idle',
          phase: GamePhase.IDLE,
          waitingStartTime: null,
          chancePhaseCompleted: false,
        });
        localStorage.removeItem('gameState');
      }
    } catch (error) {
      console.error('[useGameState] Ошибка при отмене поиска:', error);
    }
  }, [telegramUser, updateGameState]);
  
  // Установка соперника (когда нашли матч)
  const setMatch = useCallback((match: GameMatch) => {
    console.log('[useGameState] Установка матча:', match);

    // Проверка на необходимые поля
    if (!match.matchId || !match.player1Id || !match.player2Id) {
      console.error('[useGameState] Ошибка: матч не содержит необходимые поля', match);
      return;
    }

    updateGameState({
      status: 'in_progress',
      phase: GamePhase.COUNTDOWN,
      match,
      waitingStartTime: null,
      countdown: 5, // Начинаем с 5-секундного обратного отсчета
    });
    
    console.log('[useGameState] Состояние обновлено на countdown, запускаем обратный отсчет');
    
    // Запускаем обратный отсчет
    const countdownInterval = setInterval(() => {
      setGameState(prev => {
        const newCountdown = prev.countdown - 1;
        
        if (newCountdown <= 0) {
          console.log('[useGameState] Обратный отсчет завершен, очищаем интервал');
          clearInterval(countdownInterval);
          
          // После обратного отсчета переходим в фазу CHANCE
          setTimeout(() => {
            console.log('[useGameState] Переходим в фазу CHANCE');
            setGameState(currentState => {
              const updatedState = {
                ...currentState,
                phase: GamePhase.CHANCE,
                countdown: 0
              };
              setSavedGameState(updatedState);
              return updatedState;
            });
            
            // После фазы CHANCE переходим к вращению
            setTimeout(() => {
              console.log('[useGameState] Фаза CHANCE завершена, переходим к SPINNING');
              setGameState(currentState => {
                const updatedState = {
                  ...currentState,
                  phase: GamePhase.SPINNING,
                  chancePhaseCompleted: true
                };
                setSavedGameState(updatedState);
                return updatedState;
              });
            }, 2000); // показываем CHANCE 2 секунды
          }, 0);
        }
        
        const updated = { ...prev, countdown: Math.max(0, newCountdown) };
        setSavedGameState(updated);
        return updated;
      });
    }, 1000);
    
    // Очистка интервала при размонтировании
    return () => clearInterval(countdownInterval);
  }, [updateGameState, setSavedGameState]);
  
  // Завершение игры
  const completeGame = useCallback(async (result: GameResult) => {
    if (!user || !gameState.match) {
      setError('Невозможно завершить игру: нет активного матча');
      return;
    }
    
    try {
      setError(null);
      
      const response = await fetch('/api/match/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: gameState.match.matchId,
          player1Id: gameState.match.player1Id,
          player2Id: gameState.match.player2Id,
          ticketsAmount: gameState.match.ticketsAmount,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при завершении игры: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[useGameState] Игра успешно завершена:', data);
        
        const isWinner = data.data?.winnerId === user.telegramId;
        
        updateGameState({
          status: 'completed',
          phase: GamePhase.COMPLETED,
          result: {
            status: isWinner ? 'win' : 'lose',
            ticketsAmount: isWinner ? 180 : 0, // Победитель получает 180 TONOT
            winnerId: data.data?.winnerId
          },
          chancePhaseCompleted: true
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка при завершении игры');
      }
    } catch (error) {
      console.error('[useGameState] Ошибка при завершении игры:', error);
      setError(`Ошибка при завершении игры: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [user, gameState.match, updateGameState]);
  
  // Сброс состояния игры
  const resetGame = useCallback(() => {
    console.log('[useGameState] Сброс состояния игры');
    console.log('[useGameState] Предыдущее состояние:', gameState);
    
    updateGameState({
      status: 'idle',
      phase: GamePhase.IDLE,
      match: null,
      result: null,
      countdown: 0,
      waitingStartTime: null,
      chancePhaseCompleted: false,
    });
    setError(null);
    
    console.log('[useGameState] Состояние сброшено');
  }, [updateGameState, gameState]);
  
  // Создаем ref для хранения предыдущего статуса
  const prevStatus = useRef<string | null>(null);
  
  // Проверка статуса матча (если находимся в состоянии ожидания)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isWaiting && telegramUser) {
      // Функция для проверки статуса
      const checkMatchStatus = async () => {
        try {
          console.log('[useGameState] Проверка статуса для пользователя:', telegramUser.id);
          
          const response = await fetch(`/api/match/game?telegramId=${telegramUser.id}`);
          
          if (!response.ok) {
            throw new Error(`Ошибка при проверке статуса: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[useGameState] Ответ от сервера при проверке статуса:', data);
          
          if (data.success) {
            // Если пользователь не ожидает (значит нашли соперника)
            if (!data.isWaiting && data.status === 'matched' && data.match) {
              console.log('[useGameState] Найден соперник, устанавливаем матч:', data.match);
              setMatch(data.match);
              
              // Важно! Обновляем баланс пользователя, так как билет уже списался
              // Получаем обновленные данные пользователя
              try {
                const userDataResponse = await fetch(`/api/user-data?telegramId=${telegramUser.id}`);
                if (userDataResponse.ok) {
                  // Обновляем баланс
                  const userData = await userDataResponse.json();
                  if (userData.success && userData.data) {
                    console.log('[useGameState] Обновлены данные пользователя после создания матча:', userData.data);
                  }
                }
              } catch (refreshError) {
                console.error('[useGameState] Ошибка при обновлении данных пользователя:', refreshError);
              }
            } else if (!data.isWaiting && prevStatus.current === 'waiting') {
              // Статус изменился с waiting на что-то другое, и это не matched
              // Возможно, произошел сбой или отмена - перезагружаем состояние
              console.log('[useGameState] Десинхронизация: ожидание завершено, но матч не создан');
              
              // Сбрасываем состояние и обновляем данные
              updateGameState({
                status: 'idle',
                phase: GamePhase.IDLE,
                match: null,
                result: null,
                countdown: 0,
                waitingStartTime: null,
                chancePhaseCompleted: false,
              });
              
              // Обновляем баланс пользователя
              try {
                const userDataResponse = await fetch(`/api/user-data?telegramId=${telegramUser.id}`);
                if (userDataResponse.ok) {
                  // Обновляем баланс
                  const userData = await userDataResponse.json();
                  if (userData.success && userData.data) {
                    console.log('[useGameState] Обновлены данные пользователя после сброса состояния:', userData.data);
                  }
                }
              } catch (refreshError) {
                console.error('[useGameState] Ошибка при обновлении данных пользователя:', refreshError);
              }
            }
            
            // Сохраняем текущий статус для следующей проверки
            prevStatus.current = data.status;
          }
        } catch (error) {
          console.error('[useGameState] Ошибка при проверке статуса матча:', error);
        }
      };
      
      // Проверяем сразу при входе в режим ожидания
      checkMatchStatus();
      
      // Устанавливаем интервал для периодической проверки
      console.log('[useGameState] Запускаем интервал проверки статуса каждые 3 секунды');
      intervalId = setInterval(checkMatchStatus, 3000); // Каждые 3 секунды
    }
    
    return () => {
      if (intervalId) {
        console.log('[useGameState] Очищаем интервал проверки статуса');
        clearInterval(intervalId);
      }
    };
  }, [isWaiting, telegramUser, setMatch, updateGameState]);
  
  // Обработчик установки соперника
  const setOpponent = useCallback((opponent: { id: number; name: string }) => {
    if (!gameState.match) return;
    updateGameState({
      status: 'in_progress',
      phase: GamePhase.PLAYING,
      match: {
        ...gameState.match,
        player2Id: opponent.id,
        player2Name: opponent.name
      }
    });
  }, [gameState.match, updateGameState]);
  
  return {
    gameState,
    isWaiting,
    isPlaying,
    findOpponent,
    cancelWaiting,
    setOpponent,
    updateGameState,
    completeGame,
    resetGame,
    error
  };
} 