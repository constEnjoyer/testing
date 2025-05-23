'use client';

import React, { 
  createContext, 
  useState, 
  useEffect, 
  useCallback, 
  useContext, 
  ReactNode 
} from 'react';
import { initData, useSignal, useLaunchParams } from '@telegram-apps/sdk-react';
import type { TelegramUser } from '@telegram-apps/sdk-react';

// Определяем типы для контекста пользователя
export interface UserBalance {
  chance: number;
  tonotChance: number;
  tonot: number;
  ton: number;
}

export interface UserProfile {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  telegramChatId?: string;
  telegramId?: number;    // Добавляем ID пользователя Telegram
  walletAddress?: string; // Добавляем адрес кошелька
  tickets?: number;       // Добавляем поле для билетов
  // Дополнительные поля профиля могут быть добавлены здесь
}

interface UserContextProps {
  user: UserProfile | null;
  balance: UserBalance;
  isLoading: boolean;
  error: string | null;
  fetchUserData: () => Promise<void>;
  setUserLocale: (locale: string) => Promise<void>;
  updateBalance: (newBalance: UserBalance) => void;
}

// Создаем контекст с начальными значениями
const UserContext = createContext<UserContextProps>({
  user: null,
  balance: { chance: 0, tonotChance: 0, tonot: 0, ton: 0 },
  isLoading: false,
  error: null,
  fetchUserData: async () => {},
  setUserLocale: async () => {},
  updateBalance: () => {},
});

// Хук для использования контекста
export const useUser = () => useContext(UserContext);

// Интерфейс для свойств провайдера
interface UserProviderProps {
  telegramUser?: TelegramUser;
  children: ReactNode;
}

// Провайдер контекста
export const UserProvider: React.FC<UserProviderProps> = ({ telegramUser, children }) => {
  // Получаем данные пользователя из Telegram Mini Apps
  const initDataState = useSignal(initData.state);
  const telegramUserFromProps = telegramUser || initDataState?.user;

  // Состояние пользователя
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<UserBalance>({
    chance: 0,
    tonotChance: 0,
    tonot: 0,
    ton: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launch = useLaunchParams();

  // Инициализация пользователя Telegram
  const initTelegramUser = useCallback(async () => {
    if (!telegramUserFromProps) {
      console.log('[UserContext] Нет данных пользователя Telegram');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
        setUser({
          id: telegramUserFromProps.id,
          firstName: telegramUserFromProps.firstName,
          lastName: telegramUserFromProps.lastName,
          username: telegramUserFromProps.username,
        telegramId: telegramUserFromProps.id
      });
    } catch (error) {
      console.error('Ошибка при инициализации пользователя Telegram:', error);
      setError(`Ошибка инициализации: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [telegramUserFromProps]);

  // Получение данных пользователя
  const fetchUserData = useCallback(async () => {
    if (!telegramUserFromProps?.id) {
      console.log('[UserContext] Нет данных пользователя Telegram');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const timestamp = new Date().toISOString();
      console.log(`[UserContext ${timestamp}] Запрос данных пользователя:`, telegramUserFromProps.id);

      // Добавляем уникальный идентификатор запроса для избежания кэширования
      const cacheKey = Date.now();
      const response = await fetch(`/api/user-data?telegramId=${telegramUserFromProps.id}&_cache=${cacheKey}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[UserContext ${timestamp}] Ошибка при получении данных:`, errorText);
        setError(`Ошибка получения данных: ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log(`[UserContext ${timestamp}] Полный ответ API:`, JSON.stringify(data));

      // Улучшенная гибкая обработка ответа от сервера
      let newBalance = { chance: 0, tonotChance: 0, tonot: 0, ton: 0 };
      let userData = null;

      // Обработка различных форматов ответа
      if (data.success === true && data.data) {
        // Формат с вложенным объектом data и флагом success
        userData = data.data;
        
        newBalance = {
          chance: Number(data.data.tickets || 0),
          tonotChance: Number(data.data.tonotChanceTickets || 0),
          tonot: Number(data.data.balance || 0),
          ton: Number(data.data.tonBalance || 0)
        };
        
        console.log(`[UserContext ${timestamp}] Обработан ответ с вложенным объектом data:`, newBalance);
      } else if (data.tickets !== undefined || data.balance !== undefined) {
        // Формат с данными в корне объекта
        userData = data;
        
        newBalance = {
          chance: Number(data.tickets || 0),
          tonotChance: Number(data.tonotChanceTickets || 0),
          tonot: Number(data.balance || 0),
          ton: Number(data.tonBalance || 0)
        };
        
        console.log(`[UserContext ${timestamp}] Обработан ответ с данными в корне:`, newBalance);
      }

      // Обновляем данные пользователя, если получили
      if (userData) {
        setUser(prev => ({
          ...prev,
          ...userData,
          telegramId: telegramUserFromProps.id
        }));
      }

      // Обновляем баланс
      console.log(`[UserContext ${timestamp}] Итоговый баланс:`, newBalance);
      setBalance(newBalance);
      
    } catch (error) {
      console.error('[UserContext] Ошибка при получении данных:', error);
      setError('Ошибка при получении данных пользователя');
    } finally {
      setIsLoading(false);
    }
  }, [telegramUserFromProps]);

  // Сохранение локали пользователя
  const setUserLocale = useCallback(async (locale: string) => {
    if (!telegramUserFromProps) return;

    try {
      console.log('[UserContext] Сохранение локали для пользователя:', telegramUserFromProps.id, 'локаль:', locale);
      
      const response = await fetch('/api/user-locale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: telegramUserFromProps.id,
          locale: locale
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[UserContext] Локаль ${locale} успешно сохранена для пользователя ${telegramUserFromProps.id}:`, result);
        
        // Создаем событие изменения локали для глобального обновления
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('app-locale-changed', { 
            detail: { locale } 
          });
          window.dispatchEvent(event);
        }

        setError(null);
      } else {
        const errorText = await response.text();
        console.error('[UserContext] Ошибка при сохранении локали:', errorText);
        setError(`Ошибка сохранения локали: ${errorText}`);
      }
    } catch (error) {
      console.error('[UserContext] Ошибка при сохранении локали:', error);
      setError(`Ошибка сохранения локали: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [telegramUserFromProps]);

  // Улучшенная функция обновления баланса с гарантией согласованности
  const updateBalance = useCallback((newBalance: UserBalance) => {
    console.log('[UserContext] 🔄 ОБНОВЛЕНИЕ ГЛОБАЛЬНОГО БАЛАНСА:', newBalance);
    
    // Сравниваем с текущим балансом для отслеживания изменений
    const hasChanges = 
      newBalance.chance !== balance.chance ||
      newBalance.tonotChance !== balance.tonotChance ||
      newBalance.tonot !== balance.tonot ||
      newBalance.ton !== balance.ton;
    
    if (hasChanges) {
      console.log('[UserContext] 📊 ОБНАРУЖЕНЫ ИЗМЕНЕНИЯ В БАЛАНСЕ:', {
        'Старый': balance,
        'Новый': newBalance,
        'Время': new Date().toISOString()
      });
      
      // Обновляем состояние
      setBalance(newBalance);
      
      // Создаем глобальное событие обновления баланса для компонентов
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('balance-updated', { 
          detail: { balance: newBalance } 
        });
        window.dispatchEvent(event);
        console.log('[UserContext] 📢 Создано глобальное событие balance-updated');
      }
    } else {
      console.log('[UserContext] Баланс без изменений, обновление не требуется');
    }
  }, [balance]);

  // Инициализация при первом рендере
  useEffect(() => {
    if (telegramUserFromProps && !user) {
      initTelegramUser();
    }
  }, [telegramUserFromProps, user, initTelegramUser]);

  // Первоначальное получение данных пользователя при загрузке
  useEffect(() => {
    if (telegramUserFromProps?.id) {
      // Первоначальное получение данных - только один раз при загрузке
      fetchUserData();
      
      // Удалено периодическое обновление каждые 15 секунд
      // Теперь компоненты сами будут вызывать fetchUserData по необходимости
      
      console.log('[UserContext] Инициализировано без авто-обновления. Компоненты вызывают fetchUserData самостоятельно.');
    }
  }, [telegramUserFromProps, fetchUserData]);

  const contextValue = {
    user,
    balance,
    isLoading,
    error,
    fetchUserData,
    setUserLocale,
    updateBalance
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}; 