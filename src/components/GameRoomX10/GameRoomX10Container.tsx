'use client';

import React, { useCallback, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SoundContext } from '@/components/Root/Root';
import { useGameSound } from '@/contexts/GameSoundContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useSocketX10 } from '@/hooks/useSocketX10';
import { useGameStateX10 } from '@/hooks/useGameStateX10';
import { useX10Room } from '@/contexts/X10RoomContext';
import { ScreenType } from '@/components/GameMenu/components/BottomNavigation';
import { TicketPurchaseModal } from '@/components/GameMenu/components/TicketPurchaseModal';
import { ExchangeModal } from '@/components/ExchangeModal/ExchangeModal';
import { HistoryModal } from '@/components/HistoryModal/HistoryModal';
import { GameTransition } from '@/components/GameTransition/GameTransition';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { X10Player, X10Winner, X10Match as BaseX10Match } from '@/@types/x10';
import type { GamePhase } from '@/contexts/X10RoomContext';
import {
  WaitingOverlayX10,
  CountdownOverlayX10,
  ResultModalX10,
  GameControlsX10,
  GameHeaderX10,
  BottomNavigationX10,
  MergingAnimationX10,
  YinYangWheel,
  SoundButton
} from './components';
import styles from './styles/GameRoomX10Container.module.css';
import { toast } from 'react-hot-toast';

// Константы для таймингов
const GAME_TIMINGS = {
  PREPARING: 5000,    // 5 секунд на подготовку
  MERGING: 7500,      // 7.5 секунд на анимацию слияния
  WHEEL_APPEAR: 4000, // 4 секунды на появление колеса
  WHEEL_SPIN: 7000,   // 7 секунд на вращение
  WHEEL_DISAPPEAR: 2000, // 2 секунды на исчезновение
  RESULT_DELAY: 1000  // 1 секунда перед показом результатов
} as const;

// Упрощенный тип баланса
interface Balance {
  chance: number;
  tonotChance: number;
  tonot: number;
  ton: number;
}

// Константы для статусов матча
const MATCH_STATUS = {
  COMPLETED: 'completed' as const,
  WAITING: 'waiting' as const,
  PLAYING: 'playing' as const
};

interface ExtendedX10Match extends BaseX10Match {
  winners: X10Winner[];
  phase: GamePhase;
  matchId: string;
}

export const GameRoomX10Container: React.FC = () => {
  const router = useRouter();
  const t = useTranslations('game');
  const i18n = useTranslations('i18n');
  const { telegramUser } = useTelegramUser();
  
  // Получаем объект сокета
  const { 
    isConnected,
    joinX10Room
  } = useSocketX10(false);
  
  const { 
    gameState,
    isWaiting,
    findPlayers,
    cancelWaiting,
    resetGame,
    error: gameError,
    isLoading,
    handleSocketEvents,
    updateUserBalance,
    updateGameState,
    completeGame
  } = useGameStateX10(joinX10Room);

  // Состояние для баланса
  const [balance, setBalance] = useState<Balance>({
    chance: 0,
    tonotChance: 0,
    tonot: 0,
    ton: 0
  });

  // Состояния для модальных окон
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Получаем звуковые контексты
  const { playClickSound, isMuted } = useContext(SoundContext);
  const { playGameSound, stopGameSound } = useGameSound();

  const [showTransition, setShowTransition] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultShown, setResultShown] = useState(false);

  // Добавляем необходимые хуки для работы с TON
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const isWalletConnected = tonAddress !== null;

  // Адаптер для sendTransaction
  const sendTransaction = useCallback(async (amount: number, toAddress: string) => {
    // Конвертируем TON в наноТОНы (1 TON = 1e9 наноТОНов)
    const amountInNano = Math.floor(amount * 1e9).toString();
    
    const result = await tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
      messages: [
        {
          amount: amountInNano,
          address: toAddress
        }
      ]
    });
    return { boc: result.boc };
  }, [tonConnectUI]);

  // Эффект для управления звуками в зависимости от фазы
  useEffect(() => {
    const handlePhaseSound = async () => {
      if (isMuted) return;

      switch (gameState.phase) {
        case 'merging':
          console.log('[GameRoomX10] 🎵 Воспроизведение звуков слияния');
          const MERGE_DURATION = 750;
          
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              if (!isMuted) {
                playGameSound('merge');
              }
            }, i * MERGE_DURATION);
          }
          break;

        case 'wheel_appear':
          console.log('[GameRoomX10] 🎵 Воспроизведение звука появления колеса');
          await playGameSound('wheel_appear');
          break;

        case 'wheel_spin':
          console.log('[GameRoomX10] 🎵 Воспроизведение звука вращения');
          await playGameSound('x10_wheel_spin');
          break;

        case 'wheel_disappear':
          console.log('[GameRoomX10] 🎲 Фаза исчезновения колеса');
          await playGameSound('wheel_disappear');
          break;

        case 'result':
          if (!showResultModal && !resultShown) {
            const winners = gameState.winners || [];
            const isWinner = winners.find(w => w.telegramId === telegramUser?.id);
            console.log('[GameRoomX10] 🎵 Воспроизведение звука результата:', isWinner ? 'победа' : 'проигрыш');
            await playGameSound(isWinner ? 'win' : 'lose');
            
            console.log('[GameRoomX10] 🎯 Показываем результат');
            setShowResultModal(true);
            setResultShown(true);
          }
          break;

        case 'completed':
          // Останавливаем все игровые звуки при завершении
          stopGameSound('x10_wheel_spin');
          break;
      }
    };

    handlePhaseSound();
  }, [gameState.phase, gameState.winners, telegramUser?.id, showResultModal, resultShown, playGameSound, stopGameSound, isMuted]);

  // Функция обновления баланса из API - только устанавливает локальное состояние
  const updateBalance = useCallback(async () => {
    try {
      if (!telegramUser?.id) {
        console.warn('[GameRoomX10] ⚠️ Нет telegramUser.id, не могу загрузить данные');
        return;
      }
      
      const data = await updateUserBalance();
      
      if (data) {
        const apiBalance = {
          chance: Number(data.tickets || 0),
          tonotChance: Number(data.tonotChanceTickets || 0),
          tonot: Number(data.balance || 0),
          ton: Number(data.tonBalance || 0)
        };
        
        setBalance(apiBalance);
        console.log('[GameRoomX10] Баланс обновлен:', apiBalance);
      }
    } catch (error) {
      console.error('[GameRoomX10] ❌ Ошибка загрузки данных:', error);
    }
  }, [telegramUser?.id, updateUserBalance]);

  // Обновляем баланс при монтировании
  useEffect(() => {
    if (!telegramUser?.id) return;
    updateBalance();
  }, [telegramUser?.id, updateBalance]);

  // Периодическое обновление баланса
  useEffect(() => {
    if (!telegramUser?.id) return;
    
    const balanceInterval = setInterval(() => {
      updateBalance();
    }, 15000); // Каждые 15 секунд
    
    return () => clearInterval(balanceInterval);
  }, [telegramUser?.id, updateBalance]);

  // Обновляем обработчик старта игры
  const handleStartGame = async () => {
    if (balance?.chance <= 0) {
      console.log('[X10] Недостаточно билетов, показываем модальное окно');
      setShowTicketsModal(true);
      return;
    }

    try {
      await findPlayers(1);
    } catch (error) {
      console.error('[X10] Ошибка запуска игры:', error);
      toast.error('Ошибка при запуске игры');
    }
  };

  // Обновляем обработчик отмены поиска
  const handleCancelSearch = async () => {
    try {
      playClickSound();
      await cancelWaiting();
    } catch (error) {
      console.error('[X10] Ошибка отмены поиска:', error);
      toast.error('Ошибка при отмене поиска');
    }
  };

  // Обновляем обработчик закрытия модального окна результатов
  const handleCloseResultModal = useCallback(() => {
    console.log('[GameRoomX10Container] 🎮 Закрытие модального окна результатов');
    
    setShowResultModal(false);
    setResultShown(false);
    
    // Сразу сбрасываем состояние и обновляем баланс
    updateGameState({ phase: 'idle' });
    updateBalance();
  }, [updateGameState, updateBalance]);

  // Регистрируем обработчики сокет-событий через хук
  useEffect(() => {
    // Теперь настройка всех обработчиков сокетов происходит в хуке
    if (isConnected) {
      handleSocketEvents(telegramUser?.id);
  
      // Коллбэк для получения результатов
      const onResult = () => {
        setShowResultModal(true);
      };
  
      return () => {
        // Здесь можно добавить очистку, если нужно
      };
    }
  }, [isConnected, handleSocketEvents, telegramUser?.id]);

  // Обработчик закрытия модальных окон
  const handleCloseTicketsModal = () => {
    setShowTicketsModal(false);
    updateBalance();
  };

  // Функция для закрытия всех модальных окон
  const closeAllModals = useCallback(() => {
    setShowTicketsModal(false);
    setShowExchangeModal(false);
    setShowHistoryModal(false);
  }, []);

  // Переход между экранами
  const handleScreenChange = useCallback((screen: ScreenType) => {
    closeAllModals();
    
    switch (screen) {
      case ScreenType.TICKETS:
        setShowTicketsModal(true);
        break;
      case ScreenType.EXCHANGE:
        setShowExchangeModal(true);
        break;
      case ScreenType.HISTORY:
        setShowHistoryModal(true);
        break;
      case ScreenType.HOME:
        if (!showTransition) {
          playClickSound();
          setShowTransition(true);
        }
        break;
    }
  }, [closeAllModals, playClickSound, showTransition]);

  // Удаляем старый эффект очистки звуков
  useEffect(() => {
    if (gameState.phase === 'idle') {
      console.log('[GameRoomX10] Возвращаемся в исходное состояние');
    }
  }, [gameState.phase]);

  // Обработчик завершения обратного отсчета
  const handleCountdownComplete = () => {
    // Теперь это контролируется gameState, но компонент требует этот коллбэк
    console.log('[GameRoomX10] Завершен обратный отсчет');
  };

  // Страховочный запрос результатов при отсутствии победителей
  useEffect(() => {
    // Проверяем, что мы в фазе показа результатов, но победителей нет
    if (gameState.phase === 'result' && (!gameState.winners || gameState.winners.length === 0) && gameState.matchId) {
      console.log('[X10] ⚠️ В фазе результатов отсутствуют победители - пробуем запросить снова');
      
      // Запрос результатов через API
      const fetchResultsRetry = async () => {
        try {
          const response = await fetch('/api/match/x10/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              matchId: gameState.matchId,
              telegramId: telegramUser?.id
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Ошибка при получении результатов: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[X10] 📊 Результаты получены через запасной путь:', data);
          
          if (data.success && data.winners && data.winners.length > 0) {
            // Обновляем состояние с результатами
            updateGameState({
              winners: data.winners || []
            });
            
            // Показываем модальное окно
            setShowResultModal(true);
            
            // Обновляем баланс
            updateBalance();
          }
        } catch (error) {
          console.error('[X10] ❌ Ошибка при запросе результатов через запасной путь:', error);
        }
      };
      
      fetchResultsRetry();
    }
  }, [gameState.phase, gameState.winners, gameState.matchId, telegramUser?.id, updateGameState, updateBalance]);

  // Удаляем дублирующий эффект для результатов, так как теперь это обрабатывается в handlePhaseSound
  // ... existing code ...

  return (
    <div 
      className={styles.container}
    >
      {showTransition && (
        <GameTransition 
          direction="toMenu"
          onComplete={() => {
            setShowTransition(false);
            router.push('/');
          }}
        />
      )}
      <GameHeaderX10 
        balance={{
          chance: balance.chance,
          tonotChance: balance.tonotChance,
          tonot: balance.tonot,
          ton: balance.ton
        }}
      />

      {/* Добавляем кнопку звука */}
      <div className={styles.soundButtonContainer}>
        <SoundButton />
      </div>

      <div className={styles.gameContent}>
        {/* Показываем оверлей ожидания */}
        {gameState.phase === 'waiting' && (
          <WaitingOverlayX10 
            message={t('waiting_for_players')}
            onClose={handleCancelSearch}
          />
        )}

        {/* Показываем обратный отсчет */}
        {gameState.phase === 'preparing' && (
          <CountdownOverlayX10 
            onComplete={handleCountdownComplete}
          />
        )}

        {/* Показываем анимацию слияния */}
        {gameState.phase === 'merging' && (
          <MergingAnimationX10 
            onComplete={() => {}} 
          />
        )}

        {/* Показываем колесо */}
        {(gameState.phase === 'wheel_appear' || 
          gameState.phase === 'wheel_spin' || 
          gameState.phase === 'wheel_disappear') && (
          <YinYangWheel 
            phase={gameState.phase}
          />
        )}

        {/* Показываем результаты - ИСПРАВЛЯЕМ УСЛОВИЕ */}
        {(gameState.phase === 'result' || showResultModal) && (
          <ResultModalX10
            position={(() => {
              // Безопасное получение списка победителей
              const winners = gameState.winners || [];
              
              // Подробное логирование для отладки
              console.log('[GameRoomX10Container] 🏆 Проверка позиции:', {
                winners,
                telegramId: telegramUser?.id,
                winnerFound: winners.some(w => w?.telegramId === telegramUser?.id)
              });
              
              // Поиск победителя с дополнительными проверками
              const winner = winners.find(w => w && typeof w === 'object' && w.telegramId === telegramUser?.id);
              
              if (winner?.position && winner.position <= 3) {
                return winner.position;
              }
              return 0;
            })()}
            prize={(() => {
              // Безопасное получение списка победителей
              const winners = gameState.winners || [];
              
              // Поиск победителя с дополнительными проверками
              const winner = winners.find(w => w && typeof w === 'object' && w.telegramId === telegramUser?.id);
              
              if (winner?.position && winner.position <= 3) {
                return winner.prize;
              }
              return 'tonot-chance';
            })()}
            onClose={handleCloseResultModal}
            onBalanceUpdate={updateBalance}
          />
        )}

        {/* Верхние билеты (горизонтально) */}
        <div className={styles.topTickets}>
          {[1, 2, 3].map((position) => (
            <GameControlsX10
              key={`top-ticket-${position}`}
              isLoading={isLoading}
              gameStatus={MATCH_STATUS.WAITING}
              position={position}
              isBottom={false}
              isActive={gameState.phase === 'idle'}
              isMerging={gameState.phase === 'merging'}
              availableTickets={balance.chance}
              onJoinRoom={handleStartGame}
            />
          ))}
        </div>

        {/* Левые билеты (вертикально) */}
        <div className={styles.leftTickets}>
          {[4, 5, 6].map((position) => (
            <GameControlsX10
              key={`left-ticket-${position}`}
              isLoading={isLoading}
              gameStatus={MATCH_STATUS.WAITING}
              position={position}
              isBottom={false}
              isActive={gameState.phase === 'idle'}
              isMerging={gameState.phase === 'merging'}
              availableTickets={balance.chance}
              onJoinRoom={handleStartGame}
            />
          ))}
        </div>

        {/* Правые билеты (вертикально) */}
        <div className={styles.rightTickets}>
          {[7, 8, 9].map((position) => (
            <GameControlsX10
              key={`right-ticket-${position}`}
              isLoading={isLoading}
              gameStatus={MATCH_STATUS.WAITING}
              position={position}
              isBottom={false}
              isActive={gameState.phase === 'idle'}
              isMerging={gameState.phase === 'merging'}
              availableTickets={balance.chance}
              onJoinRoom={handleStartGame}
            />
          ))}
        </div>

        {/* Нижний билет */}
        <div className={styles.bottomTicket}>
          <GameControlsX10
            onJoinRoom={handleStartGame}
            isLoading={isLoading}
            gameStatus={MATCH_STATUS.WAITING}
            position={10}
            isBottom={true}
            isActive={gameState.phase === 'idle'}
            isMerging={gameState.phase === 'merging'}
            availableTickets={balance.chance}
          />
        </div>
      </div>

      {/* Модальные окна */}
      {showTicketsModal && (
        <div className={styles.modalContainer}>
          <TicketPurchaseModal
            isOpen={showTicketsModal}
            onClose={handleCloseTicketsModal}
            telegramId={telegramUser?.id}
            walletAddress={tonAddress ?? undefined}
            onPurchaseSuccess={updateBalance}
            connected={isWalletConnected}
            sendTransaction={sendTransaction}
          />
        </div>
      )}

      {showExchangeModal && (
        <div className={styles.modalContainer}>
          <ExchangeModal
            open={showExchangeModal}
            onClose={() => setShowExchangeModal(false)}
            balance={balance}
            userId={telegramUser?.id || 0}
            onSuccess={updateBalance}
          />
        </div>
      )}

      {showHistoryModal && (
        <div className={styles.modalContainer}>
          <HistoryModal
            open={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
            userId={telegramUser?.id || 0}
          />
        </div>
      )}

      {/* Нижняя навигация */}
      <div className={styles.bottomNavigationWrapper}>
        <BottomNavigationX10
          activeScreen={ScreenType.GAME_ROOM}
          onNavigate={handleScreenChange}
          useDirectHomeNavigation={true}
        />
      </div>
    </div>
  );
}; 