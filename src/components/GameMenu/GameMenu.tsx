'use client';

import React, { useState, useCallback, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Button } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import { useTonAddress } from '@tonconnect/ui-react';
import { SoundContext } from '@/components/Root/Root';
import { useUser } from '@/contexts/UserContext';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import Image from 'next/image';
import Link from 'next/link';
// Импорт компонентов
import UserBalance from './components/UserBalance';
import WelcomeMessage from './components/WelcomeMessage';
import BuyTicketsButton from './components/BuyTicketsButton';
import NavigationIcons from './components/NavigationIcons';
import HypnoWheel from './components/HypnoWheel';
import LanguageToggle from './components/LanguageToggle';
import { TicketPurchaseModal } from './components/TicketPurchaseModal';
import { ExchangeModal } from '@/components/ExchangeModal/ExchangeModal';
import { HistoryModal } from '@/components/HistoryModal/HistoryModal';
import { TonConnectButton } from '@tonconnect/ui-react';
// Новые модульные компоненты
import MenuContainer from './components/MenuContainer';
import MenuBackground from './components/MenuBackground';
import MiniHomeButton from './components/MiniHomeButton';
import StarGenerator from './components/StarGenerator';
import MenuContent from './components/MenuContent';
import HeaderProfile from './components/HeaderProfile';
import BottomNavigation, { ScreenType } from './components/BottomNavigation';
import GameButton from './components/GameButton';
import ControlButtons from './components/ControlButtons';
import ModeAwareContainer from './components/ModeAwareContainer';
import { 
  getFromLocalStorage, 
  saveToLocalStorage, 
  saveToSessionStorage,
  getFromSessionStorage,
  STORAGE_KEYS 
} from '@/utils/storageUtils';
import { GameTransition } from '@/components/GameTransition/GameTransition';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useAutoFetch } from '@/hooks/useAutoFetch';
import { useTonConnect } from '@/hooks/useTonConnect';
import toast from 'react-hot-toast';

// Добавляем новый тип для режима игры
type GameMode = 'x2' | 'x10';

export const GameMenu = () => {
  // Получаем звуковой контекст из глобального состояния
  const { isMuted, playClickSound, toggleMute, unlockAudio } = useContext(SoundContext);
  
  // Получаем данные пользователя из контекста
  const { user, balance, fetchUserData, isLoading, updateBalance } = useUser();
  
  const initDataState = useSignal(initData.state);
  const telegramUser = initDataState?.user;
  const t = useTranslations('i18n');
  const router = useRouter();
  
  // Новое состояние для управления видимостью интерфейса (гипно-режим)
  const [isHypnoMode, setIsHypnoMode] = useState<boolean>(false);
  
  // Новое состояние для "чистого космического режима"
  const [isCleanMode, setIsCleanMode] = useState<boolean>(false);

  // Состояние для баланса (в реальном приложении должно загружаться с сервера)
  const [balanceState, setBalanceState] = useState({
    chance: 0,
    tonotChance: 0,
    tonot: 0,
    ton: 0
  });
  
  // Состояние для активного экрана и модальных окон
  const [activeScreen, setActiveScreen] = useState<ScreenType>(ScreenType.HOME);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showTransition, setShowTransition] = useState<boolean>(false);
  
  // Устаревшие состояния - заменяем на activeScreen
  const [isGameRoomActive, setIsGameRoomActive] = useState<boolean>(false);
  const [isExchangeActive, setIsExchangeActive] = useState<boolean>(false);
  const [isHistoryActive, setIsHistoryActive] = useState<boolean>(false);
  
  // Получаем адрес кошелька TON через хук
  const { isConnected, address: tonAddress, sendTransaction } = useTonConnect();
  
  // Добавляем состояние для режима игры
  const [gameMode, setGameMode] = useState<GameMode>('x2');
  
  // При монтировании компонента проверяем, не возвращаемся ли мы из игровой комнаты
  useEffect(() => {
    // Пытаемся восстановить состояние из localStorage
    const savedMenuState = getFromLocalStorage(STORAGE_KEYS.MENU_STATE, null);
    if (savedMenuState) {
      try {
        const state = JSON.parse(typeof savedMenuState === 'string' ? savedMenuState : '{}');
        
        // Восстанавливаем состояние, если оно есть
        if (state.balance) setBalanceState(state.balance);
        setIsGameRoomActive(state.isGameRoomActive || false);
        setIsExchangeActive(state.isExchangeActive || false);
        setIsHistoryActive(state.isHistoryActive || false);
        
        // Устанавливаем активный экран на основе сохраненных состояний
        if (state.isGameRoomActive) {
          setActiveScreen(ScreenType.GAME_ROOM);
        } else if (state.isExchangeActive) {
          setActiveScreen(ScreenType.EXCHANGE);
        } else if (state.isHistoryActive) {
          setActiveScreen(ScreenType.HISTORY);
        } else {
          setActiveScreen(ScreenType.HOME);
        }
        
        // Добавляем состояние для режима игры
        if (state.gameMode) {
          setGameMode(state.gameMode);
        }
        
        console.log('Состояние меню восстановлено из localStorage:', state);
      } catch (error) {
        console.error('Ошибка при восстановлении состояния меню:', error);
      }
    }
  }, []);
  
  // Состояние для мерцающих звезд
  const [stars, setStars] = useState<React.ReactNode[]>([]);
  const starsTotalCount = 60; // Уменьшаем количество звезд для производительности (было 150)
  const starsPerBatch = 3; // Уменьшаем количество обновляемых звезд за раз (было 5)
  
  // Цвета звезд в useMemo, чтобы массив не пересоздавался при каждом рендере
  const starColors = React.useMemo(() => ['white', 'blue', 'pink', 'yellow'], []);  // Убираем два цвета для упрощения
  
  // Функция для получения случайного значения из массива
  const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  // Функция для генерации новых звезд с случайными позициями
  const generateInitialStars = React.useCallback(() => {
    const newStars: React.ReactNode[] = [];
    
    for (let i = 0; i < starsTotalCount; i++) {
      const color = getRandomItem(starColors);
      const left = Math.random() * 100; // Случайная позиция по X (%)
      const top = Math.random() * 100; // Случайная позиция по Y (%)
      const size = Math.random() * 4 + 2; // Случайный размер от 2px до 6px
      const duration = Math.random() * 4 + 2; // Случайная длительность анимации от 2 до 6 секунд
      const delay = Math.random() * 15; // Распределяем задержки до 15 секунд для начального запуска
      
      newStars.push(
        <div 
          key={`star-${i}-${Math.random()}`}
          className={`star star-${color}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            // Используем CSS переменные через объект style как строковые свойства
            '--duration': `${duration}s`,
            '--delay': `${delay}s`,
          } as React.CSSProperties}
        />
      );
    }
    
    setStars(newStars);
  }, [starsTotalCount, starColors]);
  
  // Функция для обновления части звезд
  const updateRandomStars = React.useCallback(() => {
    setStars(prevStars => {
      const newStars = [...prevStars];
      
      // Обновляем только несколько случайных звезд
      for (let i = 0; i < starsPerBatch; i++) {
        const randomIndex = Math.floor(Math.random() * starsTotalCount);
        
        const color = getRandomItem(starColors);
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const size = Math.random() * 4 + 2;
        const duration = Math.random() * 4 + 2;
        const delay = Math.random() * 1; // Малая задержка, чтобы звезда начала мерцать почти сразу
        
        newStars[randomIndex] = (
          <div 
            key={`star-${randomIndex}-${Math.random()}`}
            className={`star star-${color}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              '--duration': `${duration}s`,
              '--delay': `${delay}s`,
            } as React.CSSProperties}
          />
        );
      }
      
      return newStars;
    });
  }, [starsPerBatch, starsTotalCount, starColors]);
  
  // Генерируем начальные звезды при первой загрузке
  useEffect(() => {
    generateInitialStars();
    
    // Обновляем несколько случайных звезд каждые 600мс (вместо 200мс)
    const intervalId = setInterval(() => {
      updateRandomStars();
    }, 600);
    
    return () => clearInterval(intervalId);
  }, [generateInitialStars, updateRandomStars]);
  
  // Инициализация и синхронизация данных пользователя
  useEffect(() => {
    // Функция для отправки данных пользователя Telegram на сервер
    const initTelegramUser = async () => {
      if (telegramUser) {
        console.log('Инициализация пользователя Telegram с ID:', telegramUser.id);
        
        try {
          // Отправляем данные пользователя на сервер
          const response = await fetch('/api/telegram-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: telegramUser.id,
              first_name: telegramUser.firstName,
              last_name: telegramUser.lastName,
              username: telegramUser.username,
              telegram_chat_id: String(telegramUser.id)
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Пользователь Telegram инициализирован:', result);
          } else {
            console.error('Ошибка при инициализации пользователя Telegram:', await response.text());
          }
        } catch (error) {
          console.error('Ошибка при инициализации пользователя Telegram:', error);
        }
      }
    };
    
    // Инициализируем пользователя
    initTelegramUser();
  }, [telegramUser]);
  
  // Принудительное обновление баланса при монтировании компонента
  useEffect(() => {
    // Получаем баланс сразу при открытии меню
    fetchUserData();
    console.log('[GameMenu] Запрос обновления баланса при входе в меню');
    
    // Устанавливаем обновление баланса в меню
    const balanceInterval = setInterval(() => {
      fetchUserData();
      console.log('[GameMenu] Периодическое обновление баланса в меню');
    }, 15000); // Каждые 15 секунд (было 5000)
    
    return () => {
      clearInterval(balanceInterval);
    };
  }, [fetchUserData]);

  // Функция закрытия всех модальных окон
  const closeAllModals = useCallback(() => {
    setIsTicketModalOpen(false);
    setIsExchangeModalOpen(false);
    setIsHistoryModalOpen(false);
  }, []);

  // Обработчик для кнопки домой
  const handleHomeClick = useCallback(() => {
    console.log('[GameMenu] Обработка клика по кнопке ДОМОЙ');
    playClickSound();
    
    // Очищаем все состояния
    setShowTransition(false);
    setIsHypnoMode(false);
    setIsCleanMode(false);
    setActiveScreen(ScreenType.HOME);
    
    // Закрываем все модальные окна
    setIsTicketModalOpen(false);
    setIsExchangeModalOpen(false);
    setIsHistoryModalOpen(false);
    
    // Принудительно очищаем историю навигации
    window.history.pushState({}, '', window.location.pathname);
    
    // Сохраняем состояние
    saveToLocalStorage(STORAGE_KEYS.ACTIVE_SCREEN, ScreenType.HOME);
  }, [playClickSound]);

  // Обновляем handleNavigate для поддержки режимов
  const handleNavigate = useCallback((screen: ScreenType) => {
    console.log('[GameMenu] Навигация к экрану:', screen);
    playClickSound();
    
    // Очищаем предыдущее состояние перед навигацией
    setShowTransition(false);
    setIsHypnoMode(false);
    setIsCleanMode(false);
    
    // Сбрасываем все модальные окна
    setIsTicketModalOpen(false);
    setIsExchangeModalOpen(false);
    setIsHistoryModalOpen(false);
    
    // Обновляем активный экран
    setActiveScreen(screen);
    
    // Обрабатываем специальные случаи
    switch (screen) {
      case ScreenType.TICKETS:
        setIsTicketModalOpen(true);
        break;
      case ScreenType.EXCHANGE:
        setIsExchangeModalOpen(true);
        break;
      case ScreenType.HISTORY:
        setIsHistoryModalOpen(true);
        break;
      case ScreenType.HOME:
        handleHomeClick();
        break;
    }
    
    // Сохраняем состояние в localStorage
    saveToLocalStorage(STORAGE_KEYS.ACTIVE_SCREEN, screen);
  }, [playClickSound, handleHomeClick]);

  /**
   * Обработчик успешной покупки билетов
   */
  const handlePurchaseSuccess = useCallback((ticketData: any) => {
    console.log(`[GameMenu] Успешно приобретено билетов:`, ticketData);
    
    // Обновляем баланс напрямую через функцию из контекста
    if (ticketData && (ticketData.data || ticketData.tickets !== undefined)) {
      const data = ticketData.data || ticketData;
      
      updateBalance({
        chance: data.tickets || 0,
        tonotChance: data.tonotChanceTickets || 0,
        tonot: data.balance || 0,
        ton: data.tonBalance || 0
      });
      
      console.log('[GameMenu] Баланс обновлен напрямую:', {
        chance: data.tickets,
        tonotChance: data.tonotChanceTickets,
        tonot: data.balance,
        ton: data.tonBalance
      });
    }
    
    // Дополнительно запускаем fetchUserData для полной синхронизации с сервером
    fetchUserData();
    
    // Показываем информационное сообщение
    console.log(`Успешно приобретено билетов!`);
  }, [fetchUserData, updateBalance]);

  // Обработчик для кнопки игровой комнаты с поддержкой режимов
  const handleGameRoomClick = (mode: GameMode) => {
    console.log('[GameMenu] Переход в игровую комнату:', mode);
    playClickSound();
    
    // Сохраняем текущий режим
    setGameMode(mode);
    
    // Показываем анимацию перехода
    setShowTransition(true);
    
    // Переходим в соответствующую комнату
    const route = mode === 'x10' ? '/game-x10' : '/game-room';
    router.push(route);
  };

  // Обработчик для завершения анимации перехода
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
  }, []);

  // Обновляем обработчик для кнопки игровой комнаты
  const handleGameButtonClick = useCallback(() => {
    console.log('[GameMenu] Запуск перехода в игровую комнату');
    playClickSound();
    
    // Показываем анимацию перехода
    setShowTransition(true);
  }, [playClickSound]);
  
  // Обработчики для модальных окон
  const handleCloseTicketModal = useCallback(() => {
    playClickSound();
    setIsTicketModalOpen(false);
  }, [playClickSound]);

  const handleCloseExchangeModal = useCallback(() => {
    playClickSound();
    setIsExchangeModalOpen(false);
  }, [playClickSound]);

  const handleCloseHistoryModal = useCallback(() => {
    playClickSound();
    setIsHistoryModalOpen(false);
  }, [playClickSound]);

  // Эффект для инициализации меню при монтировании
  useEffect(() => {
    const initializeMenu = async () => {
      try {
        // Восстанавливаем состояние из localStorage
        const savedScreen = getFromLocalStorage<ScreenType>(STORAGE_KEYS.ACTIVE_SCREEN, ScreenType.HOME);
        setActiveScreen(savedScreen);

        // Загружаем данные пользователя
        if (telegramUser?.id) {
          await fetchUserData();
        }

        console.log('[GameMenu] Меню инициализировано:', { savedScreen });
      } catch (error) {
        console.error('[GameMenu] Ошибка при инициализации меню:', error);
      }
    };

    initializeMenu();
  }, [telegramUser?.id, fetchUserData]);

  // Функция для переключения гипно-режима
  const toggleHypnoMode = useCallback(() => {
    playClickSound();
    setIsHypnoMode(prev => {
      // Если включаем гипно-режим, блокируем прокрутку
      if (!prev) {
        document.body.classList.add('hypno-active');
        console.log('Гипно-режим активирован');
      } else {
        document.body.classList.remove('hypno-active');
        console.log('Гипно-режим деактивирован');
      }
      return !prev;
    });
  }, [playClickSound]);

  // Функция для активации/деактивации "чистого космического режима"
  const toggleCleanMode = useCallback(() => {
    playClickSound();
    
    // Просто переключаем режим без дополнительной логики
    setIsCleanMode(prev => !prev);
    
    // Выходим из гипно-режима при необходимости
    if (isHypnoMode) {
      setIsHypnoMode(false);
    }
  }, [playClickSound, isHypnoMode]);
  
  // Эффект для очистки классов при размонтировании компонента
  useEffect(() => {
    return () => {
      // Убираем классы при размонтировании компонента
      document.body.classList.remove('hypno-active');
    };
  }, []);

  // Генерируем звезды для фона
  const starGenerator = <StarGenerator starCount={150} />;

  return (
    <MenuContainer isCleanMode={isCleanMode}>
      {/* Фон с падающими монетами и звездами */}
      <MenuBackground stars={starGenerator} isCleanMode={isCleanMode} />
      
      {/* Мини-кнопка домой для возврата из чистого режима */}
      <MiniHomeButton onClick={toggleCleanMode} isVisible={isCleanMode} />

      {/* Прокручиваемый контейнер с содержимым меню - скрываем полностью в чистом режиме */}
      {!isCleanMode && (
        <MenuContent isCleanMode={isCleanMode}>
          {/* Шапка профиля с аватаром и именем - скрываем в гипно-режиме */}
          {!isHypnoMode && (
            <HeaderProfile 
              data-component="header-profile"
              photoUrl={telegramUser?.photoUrl}
              firstName={telegramUser?.firstName}
              lastName={telegramUser?.lastName}
              isHypnoMode={isHypnoMode}
              isCleanMode={isCleanMode}
              telegramId={telegramUser?.id ? String(telegramUser.id) : undefined}
            />
          )}
          
          {/* Блок баланса пользователя - расположен сразу под профилем */}
          {!isHypnoMode && (
            <div data-component="user-balance" style={{ marginTop: '5px', marginBottom: '5px' }}>
              <UserBalance />
            </div>
          )}

          {/* Приветственное сообщение - расположено под балансом */}
          {!isHypnoMode && (
            <div data-component="welcome-message" style={{ marginTop: '5px', marginBottom: '10px' }}>
              <WelcomeMessage />
            </div>
          )}

          {/* Гипнотическое колесо в центре страницы - отображается всегда */}
          <div className="flex justify-center items-center my-2">
            <HypnoWheel isHypnoMode={isHypnoMode} toggleHypnoMode={toggleHypnoMode} />
          </div>
          
          {/* Элементы, которые скрываются в обоих режимах */}
          {!isHypnoMode && (
            <>
              {/* Кнопка перехода в игровую комнату */}
              <div className="mt-3 mb-4">
                <GameButton 
                  onClick={handleGameRoomClick} 
                  isCleanMode={isCleanMode}
                />
              </div>
              
              {/* Кнопки управления */}
              <ControlButtons 
                isMuted={isMuted} 
                onToggleMute={toggleMute} 
                onRefresh={fetchUserData} 
              />
            </>
          )}
          
          {/* Обновляем модальные окна с новыми обработчиками */}
          <TicketPurchaseModal
            isOpen={isTicketModalOpen}
            onClose={handleCloseTicketModal}
            telegramId={telegramUser?.id}
            walletAddress={tonAddress ?? undefined}
            onPurchaseSuccess={handlePurchaseSuccess}
            connected={isConnected}
            sendTransaction={sendTransaction}
          />
          
          {isExchangeModalOpen && telegramUser && (
            <ExchangeModal
              open={isExchangeModalOpen}
              onClose={handleCloseExchangeModal}
              balance={{
                tonot: balanceState.tonot,
                ton: balanceState.ton || 0
              }}
              userId={telegramUser.id}
              onSuccess={() => {
                handleCloseExchangeModal();
                fetchUserData();
              }}
            />
          )}
          
          {isHistoryModalOpen && telegramUser && (
            <HistoryModal
              open={isHistoryModalOpen}
              onClose={handleCloseHistoryModal}
              userId={telegramUser.id}
            />
          )}
        </MenuContent>
      )}
      
      {/* Нижняя панель навигации - скрываем в чистом режиме */}
      {!isCleanMode && (
        <BottomNavigation 
          activeScreen={activeScreen}
          onScreenChange={handleNavigate}
          onHomeClick={handleHomeClick}
          isHypnoMode={isHypnoMode}
        />
      )}
      
      {/* Анимация перехода */}
      {showTransition && (
        <GameTransition 
          direction="toGame"
          onComplete={handleTransitionComplete}
        />
      )}
    </MenuContainer>
  );
};

export default GameMenu; 