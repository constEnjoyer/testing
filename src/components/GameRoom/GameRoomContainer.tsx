'use client';

import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

// Заменяем импорты
import { 
  GameHeader, 
  YinYangWheel, 
  BottomNavigation, 
  WaitingOverlay,
  CountdownOverlay,
  ResultModal,
  GameControls,
  ChanceOverlay 
} from './components';
import { ScreenType } from './components/BottomNavigation';

// Импортируем хуки и утилиты
import { 
  useGameState, 
  type GameState
} from '@/hooks/useGameState';
import { 
  GamePhase, 
  GameStatus, 
  type GameResult,
  type Match as GameMatch 
} from '@/@types/game';
import { useSocket } from '@/hooks/useSocket';
import { useStorage, STORAGE_KEYS } from '@/hooks/useStorage';
import { ExchangeModal } from '@/components/ExchangeModal/ExchangeModal';
import { TicketPurchaseModal } from '@/components/GameMenu/components/TicketPurchaseModal';
import { HistoryModal } from '@/components/HistoryModal/HistoryModal';
import { useUser } from '@/contexts/UserContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { SoundContext } from '@/components/Root/Root';
import { GameTransition } from '@/components/GameTransition/GameTransition';
import styles from './styles/GameRoomContainer.module.css';
import { gameApi } from '@/utils/api';
import { useTonConnect } from '@/hooks/useTonConnect';

// Локальный тип для баланса
interface Balance {
  chance: number;
  tonotChance: number;
  tonot: number;
  ton: number;
}

// Состояние для модальных окон
interface ModalState {
  tickets: boolean;
  exchange: boolean;
  history: boolean;
  menuTransition: boolean;
  reset: boolean;
  resetGame: boolean;
}

// Интерфейс для состояния, сохраняемого в хранилище
interface GameRoomSavedState {
  waitingCancelled?: boolean;
  isWheelSpinning?: boolean;
}

/**
 * GameRoomContainer - основной компонент игровой комнаты
 * 
 * Этот компонент отвечает за:
 * - Использование хуков для управления состоянием игры
 * - Управление навигацией между экранами
 * - Рендеринг основного интерфейса игровой комнаты
 */
const GameRoomContainer: React.FC = () => {
  const router = useRouter();
  const i18n = useTranslations('i18n');
  const gameT = useTranslations('game');
  const menuT = useTranslations('menu');
  
  // Флаг для отслеживания разблокировки аудио
  const hasUnlockedAudioRef = useRef<boolean>(false);
  
  // Звуковой контекст из Root
  const { 
    playClickSound, 
    playGameEffect, 
    cleanupSounds,
    toggleMute,
    isMuted 
  } = useContext(SoundContext);
  
  const [activeScreen, setActiveScreen] = useState<ScreenType>(ScreenType.GAME_ROOM);
  
  // Данные пользователя
  const { user, updateBalance, fetchUserData } = useUser();
  const { telegramUser } = useTelegramUser();
  const { isConnected, address, sendTransaction } = useTonConnect();
  
  // Локальное состояние для баланса
  const [balance, setBalance] = useState<Balance>({
    chance: 0,
    tonotChance: 0,
    tonot: 0,
    ton: 0
  });
  
  // Подключаем сокет для реальной-синхронизации
  const { isConnected: socketIsConnected, on, emit } = useSocket(true); // включаем autoConnect
  
  // Логирование полученных данных
  console.log('[GameRoomContainer] 🔍 ПОДРОБНЫЕ ДАННЫЕ:', {
    'balance.chance': balance?.chance,
    'typeof balance.chance': typeof balance?.chance
  });
  
  // Используем хук useGameState для управления состоянием игры
  const { 
    gameState, 
    findOpponent,
    cancelWaiting,
    completeGame,
    resetGame: resetGameState,
    error: gameError,
    setOpponent,
    updateGameState
  } = useGameState();
  
  // Сохраняем локальные состояния для пользовательского интерфейса
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Определяем текущую фазу для рендеринга
  const currentPhase = gameState.phase;
  
  // Объединяем состояния модалок в один объект
  const [modalState, setModalState] = useState<ModalState>({
    tickets: false,
    exchange: false,
    history: false,
    menuTransition: false,
    reset: false,
    resetGame: false
  });
  
  // Получаем сохраненное состояние
  const { 
    value: savedGameRoomState, 
    setValue: setSavedGameRoomState 
  } = useStorage<GameRoomSavedState>(STORAGE_KEYS.GAME_ROOM_STATE);
  
  // Добавляем необходимые хуки для работы с TON
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const isWalletConnected = tonAddress !== null;

  // Адаптер для отправки транзакций TON
  const tonSendTransaction = useCallback(async (amount: number, toAddress: string) => {
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

  // Функция обновления баланса
  const refreshBalance = useCallback(async () => {
    try {
      if (!telegramUser?.id) {
        console.warn('[GameRoom] ⚠️ Нет telegramUser.id, не могу загрузить данные');
        return;
      }
      
      const cacheKey = Date.now();
      const response = await fetch(`/api/user-data?telegramId=${telegramUser.id}&_cache=${cacheKey}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка при получении данных: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const apiBalance = {
          chance: Number(data.data.tickets || 0),
          tonotChance: Number(data.data.tonotChanceTickets || 0),
          tonot: Number(data.data.balance || 0),
          ton: Number(data.data.tonBalance || 0)
        };
        
        setBalance(apiBalance);
      }
    } catch (error) {
      console.error('[GameRoom] ❌ Ошибка загрузки данных:', error);
      setError('Ошибка загрузки данных');
    }
  }, [telegramUser?.id]);

  // Обновляем баланс при монтировании
  useEffect(() => {
    if (!telegramUser?.id) return;
    refreshBalance();
  }, [telegramUser?.id, refreshBalance]);

  // Периодическое обновление баланса
  useEffect(() => {
    if (!telegramUser?.id) return;
    
    const balanceInterval = setInterval(() => {
      refreshBalance();
    }, 15000); // Каждые 15 секунд
    
    return () => clearInterval(balanceInterval);
  }, [telegramUser?.id, refreshBalance]);
  
  // Удаляем эффект с глобальными обработчиками
  
  // Обработчик для кнопки звука
  const handleSoundToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события
    toggleMute();
  }, [toggleMute]);

  // Вычисляемые значения для фаз игры
  const gameResultValue = useMemo(() => {
    console.log('[GameRoom] 🎲 Вычисляем результат игры:', {
      phase: currentPhase,
      result: gameState.result
    });
    
    return gameState.result?.status === 'win' ? 'win' : 'lose';
  }, [gameState.result, currentPhase]);

  // Обработчик для звуков при вращении
  useEffect(() => {
    if (currentPhase === GamePhase.SPINNING && !isMuted) {
      console.log('[GameRoom] 🎲 Начало вращения колеса');
      playGameEffect('spin', true);
      
      return () => {
        console.log('[GameRoom] 🛑 Остановка звуков');
        cleanupSounds();
      };
    }
  }, [currentPhase, playGameEffect, cleanupSounds, isMuted]);

  // Обработчик для звуков результата
  useEffect(() => {
    if (gameState.result) {
      cleanupSounds();
      if (!isMuted) {
        playGameEffect(gameState.result.status === 'win' ? 'win' : 'lose');
      }
    }
  }, [gameState.result, playGameEffect, cleanupSounds, isMuted]);
  
  // Добавляем эффект для очистки звуков при завершении игры
  useEffect(() => {
    if (gameState.status === 'completed') {
      console.log('[GameRoom] 🎮 Игра завершена, очищаем звуки');
      cleanupSounds();
    }
  }, [gameState.status, cleanupSounds]);
  
  // Эффект для обработки сокет-событий
  useEffect(() => {
    if (!socketIsConnected || !telegramUser?.id) return;
    
    // Нашли соперника -> COUNTDOWN
    const unsubscribeOpponentFound = on('opponent_found', (matchData) => {
      if (!matchData) return;
      
      updateGameState({
        status: 'in_progress',
        phase: GamePhase.COUNTDOWN,
        match: {
          ...matchData,
          createdAt: matchData.createdAt ? matchData.createdAt.toString() : new Date().toString()
        },
        waitingStartTime: null,
        countdown: 5
      });
    });
    
    // Игра завершена -> RESULT
    const unsubscribeGameCompleted = on('game_completed', (data) => {
      console.log('[GameRoom] 📬 Получено событие game_completed:', data);
      
      if (!data) {
        console.warn('[GameRoom] ⚠️ Получены пустые данные в game_completed');
        return;
      }

      cleanupSounds();
      
      console.log('[GameRoom] 🎮 Обновляем состояние игры на RESULT');
      
      // Сначала обновляем состояние
      updateGameState({
        status: 'completed',
        phase: GamePhase.RESULT,
        result: {
          status: data.isWinner ? 'win' : 'lose',
          ticketsAmount: data.isWinner ? 180 : 0
        }
      });
      
      // Обновляем баланс после получения результата
      refreshBalance();
    });
    
    return () => {
      unsubscribeOpponentFound();
      unsubscribeGameCompleted();
    };
  }, [socketIsConnected, telegramUser?.id, updateGameState, cleanupSounds, refreshBalance, on]);
  
  // Обработчик запуска игры
  const handleStartGame = useCallback(async () => {
    try {
      console.log('[GameRoom] Запуск игры');
      setIsLoading(true);
      setError(null);
      
      if (balance?.chance <= 0) {
        setError('Недостаточно билетов для игры');
        return;
      }
      
      // Воспроизводим звук клика ДО асинхронной операции
      playClickSound();
      
      await findOpponent(1);
      
      // Немедленно обновляем локальный баланс
      setBalance(prev => ({
        ...prev,
        chance: Math.max(0, prev.chance - 1)
      }));
    } catch (error) {
      console.error('[GameRoom] Ошибка при запуске игры:', error);
      setError('Ошибка при запуске игры. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  }, [balance, findOpponent, playClickSound]);
  
  // Обработчик отмены ожидания
  const handleCancelWaiting = useCallback(async () => {
    try {
      console.log('[GameRoom] Отмена ожидания');
      setIsLoading(true);
      playClickSound();
      await cancelWaiting();
      await refreshBalance(); // Обновляем баланс после отмены
    } catch (error) {
      console.error('[GameRoom] Ошибка при отмене ожидания:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cancelWaiting, playClickSound, refreshBalance]);
  
  // Обработчик сброса игры
  const resetGame = useCallback(() => {
    console.log('[GameRoom] Сброс игры');
    resetGameState();
    updateGameState({ chancePhaseCompleted: false });
    refreshBalance();
  }, [resetGameState, updateGameState, refreshBalance]);
  
  // Единый обработчик для модалок
  const handleModal = useCallback((modal: keyof ModalState, isOpen: boolean) => {
    setModalState((prev: ModalState) => ({ ...prev, [modal]: isOpen }));
  }, []);

  // Обработчик навигации
  const handleScreenChange = useCallback((screen: ScreenType) => {
    playClickSound();

    switch (screen) {
      case ScreenType.HOME:
        handleModal('menuTransition', true);
        break;
      case ScreenType.TICKETS:
        handleModal('tickets', true);
        break;
      case ScreenType.EXCHANGE:
        handleModal('exchange', true);
        break;
      case ScreenType.HISTORY:
        handleModal('history', true);
        break;
    }
  }, [handleModal, playClickSound]);

  // Обработчики успешных действий
  const handlePurchaseSuccess = useCallback(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleExchangeSuccess = useCallback(() => {
    handleModal('exchange', false);
    refreshBalance();
  }, [handleModal, refreshBalance]);

  // Обновляем обработчик завершения вращения колеса
  const handleSpinComplete = useCallback(() => {
    console.log('[GameRoom] 🎡 Колесо остановилось');
    
    const matchId = gameState.match?.matchId;
    const player1Id = gameState.match?.player1Id;
    const player2Id = gameState.match?.player2Id;
    
    if (!matchId || !player1Id || !player2Id) {
      console.error('[GameRoom] ❌ Отсутствуют необходимые данные матча:', { matchId, player1Id, player2Id });
      return;
    }
    
    // Останавливаем звук вращения
    cleanupSounds();
    
    // Проверяем фазу
    if (currentPhase === GamePhase.SPINNING && gameState.status === 'in_progress') {
      console.log('[GameRoom] 🎲 Отправляем запрос на завершение игры');
      
      gameApi.completeGame({
        matchId,
        player1Id,
        player2Id,
        ticketsAmount: gameState.match?.ticketsAmount || 0,
        winnerId: null // API сам определит победителя
      }).then(response => {
        console.log('[GameRoom] 📬 Получен ответ от API:', response);
        
        if (response.success && response.data) {
          const isWinner = response.data.winnerId === telegramUser?.id;
          
          // Обновляем состояние игры
          updateGameState({
            status: 'completed',
            phase: GamePhase.RESULT,
            result: {
              status: isWinner ? 'win' : 'lose',
              ticketsAmount: isWinner ? 180 : 0
            }
          });
          
          // Обновляем баланс
          refreshBalance();
        }
      }).catch(console.error);
    }
  }, [gameState.match, currentPhase, gameState.status, cleanupSounds, telegramUser?.id, updateGameState, refreshBalance]);

  // Объединенный эффект для звуков и фаз игры
  useEffect(() => {
    // Логируем фазу игры
    const activePhase = currentPhase === GamePhase.WAITING ? 'waiting' : 
                      currentPhase === GamePhase.COUNTDOWN ? 'countdown' : 
                      currentPhase === GamePhase.CHANCE ? 'chance' : 
                      currentPhase === GamePhase.SPINNING ? 'spinning' : 
                      currentPhase === GamePhase.RESULT ? 'result' : 'idle';
                      
    console.log('[GameRoom] 🔄 Текущая фаза игры:', activePhase);
    
    // Автоматическое завершение фазы ШАНС
    if (currentPhase === GamePhase.CHANCE) {
      const timer = setTimeout(() => {
        console.log('[GameRoom] ⏱️ Автоматическое завершение фазы ШАНС');
        updateGameState({ chancePhaseCompleted: true });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    // Мониторинг изменений состояния игры
    console.log('[GameRoomContainer] Изменилось состояние игры:', {
      status: gameState.status,
      match: gameState.match,
      isWaiting: currentPhase === GamePhase.WAITING,
      isPlaying: currentPhase === GamePhase.PLAYING,
      chancePhaseCompleted: gameState.chancePhaseCompleted
    });
    
  }, [
    currentPhase,
    gameState,
    updateGameState
  ]);

  return (
    <div className={styles.container}>
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <p>{gameT('loading')}</p>
        </div>
      )}
      
      {/* Фоновые элементы */}
      <div className={styles.starsBackground}></div>
      <div className={styles.gridFloor}></div>
      
      {/* Декоративные элементы */}
      <div className={styles.coin1}></div>
      <div className={styles.coin2}></div>
      <div className={styles.coin3}></div>
      <div className={styles.coin4}></div>
      <div className={styles.coin5}></div>
      
      {/* Кнопка звука */}
      <button 
        className={styles.soundButton}
        onClick={handleSoundToggle}
        aria-label={isMuted ? i18n('unmute_sound') : i18n('mute_sound')}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      
      {/* Интерфейс игровой комнаты */}
      <GameHeader balance={balance} />
      
      <div className={styles.content}>
        {/* Колесо всегда отображается, но меняет свое состояние */}
        <YinYangWheel 
          isSpinning={currentPhase === GamePhase.SPINNING} 
          onSpinComplete={handleSpinComplete}
        />

        {/* Кнопка управления игрой - ВСЕГДА отображается */}
        <GameControls
          user={user}
          balance={balance}
          isWaiting={currentPhase === GamePhase.WAITING}
          isWheelSpinning={currentPhase === GamePhase.SPINNING}
          showCountdown={currentPhase === GamePhase.COUNTDOWN}
          showGameResult={currentPhase === GamePhase.RESULT}
          isLoading={isLoading}
          error={error || gameError}
          onStartGame={handleStartGame}
        />
      </div>
      
      {/* Нижняя навигация */}
      <BottomNavigation 
        activeScreen={ScreenType.GAME_ROOM}
        onNavigate={handleScreenChange}
        useDirectHomeNavigation={false}
      />
      
      {/* Оверлеи поверх основного контента */}
      {currentPhase === GamePhase.WAITING && (
        <WaitingOverlay 
          waitingStartTime={gameState.waitingStartTime}
          onCancelWaiting={handleCancelWaiting}
        />
      )}
      
      <CountdownOverlay 
        isVisible={currentPhase === GamePhase.COUNTDOWN}
        countdown={gameState.countdown}
        opponentName={telegramUser?.id === gameState.match?.player1Id ? gameState.match?.player2Name : gameState.match?.player1Name}
        onCountdownComplete={() => updateGameState({ countdown: 0 })}
      />
      
      <ResultModal 
        isVisible={currentPhase === GamePhase.RESULT}
        result={gameResultValue}
        winAmount={gameState.result?.ticketsAmount || 0}
        onClose={() => {
          console.log('[GameRoom] 🔄 Закрываем модальное окно результата');
          resetGame();
        }}
      />
      
      <ChanceOverlay isVisible={currentPhase === GamePhase.CHANCE} />
      
      {/* Модальные окна */}
      {modalState.tickets && (
        <TicketPurchaseModal
          isOpen={true}
          onClose={() => handleModal('tickets', false)}
          onPurchaseSuccess={handlePurchaseSuccess}
          telegramId={telegramUser?.id}
          walletAddress={tonAddress ?? undefined}
          connected={isWalletConnected}
          sendTransaction={tonSendTransaction}
        />
      )}
      
      {modalState.exchange && (
        <ExchangeModal
          open={true}
          onClose={() => handleModal('exchange', false)}
          balance={balance}
          userId={telegramUser?.id || ''}
          onSuccess={handleExchangeSuccess}
        />
      )}
      
      {modalState.history && (
        <HistoryModal
          open={true}
          onClose={() => handleModal('history', false)}
          userId={telegramUser?.id || ''}
        />
      )}
      
      {/* Анимация перехода */}
      {modalState.menuTransition && (
        <GameTransition 
          direction="toMenu"
          onComplete={() => {
            handleModal('menuTransition', false);
            router.push('/');
          }}
        />
      )}
    </div>
  );
};

export default GameRoomContainer; 