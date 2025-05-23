import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { CONFIG } from '@/lib/config';

// Интерфейс пользователя
export interface User {
  _id: string;
  telegramId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  balance: number;
  tickets?: number;
  tonotChanceTickets?: number;
  tonBalance?: number;
  locale?: string;
  createdAt: string;
  updatedAt: string;
}

// Результат хука пользователя
interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (telegramData: any) => Promise<User>;
  logout: () => void;
  fetchUserBalance: () => Promise<number>;
}

/**
 * Хук для работы с пользователем
 * @returns {UseUserResult} Объект с данными пользователя и методами
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Локальное хранилище для пользовательских данных
  const [storedUser, setStoredUser] = useLocalStorage<User | null>(
    CONFIG.STORAGE_KEYS.TELEGRAM_USER,
    null
  );
  
  // Инициализация пользователя при загрузке
  useEffect(() => {
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, [storedUser]);
  
  // Авторизация пользователя
  const login = useCallback(async (telegramData: any): Promise<User> => {
    try {
      setLoading(true);
      setError(null);
      
      // Отправка данных на сервер для аутентификации
      const response = await fetch(`${CONFIG.API_URL}/auth/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telegramData }),
      });
      
      if (!response.ok) {
        throw new Error('Ошибка авторизации');
      }
      
      const userData = await response.json();
      setUser(userData.user);
      setStoredUser(userData.user);
      
      return userData.user;
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при авторизации');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setStoredUser]);
  
  // Выход пользователя
  const logout = useCallback(() => {
    setUser(null);
    setStoredUser(null);
  }, [setStoredUser]);
  
  // Получение актуального баланса пользователя
  const fetchUserBalance = useCallback(async (): Promise<number> => {
    if (!user?._id) {
      setError('Пользователь не авторизован');
      return 0;
    }
    
    try {
      const response = await fetch(`${CONFIG.API_URL}/users/${user._id}/balance`);
      
      if (!response.ok) {
        throw new Error('Ошибка получения баланса');
      }
      
      const data = await response.json();
      
      // Обновляем данные пользователя с новым балансом
      setUser(prev => prev ? { ...prev, balance: data.balance } : null);
      setStoredUser(prev => prev ? { ...prev, balance: data.balance } : null);
      
      return data.balance;
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при получении баланса');
      return user?.balance || 0;
    }
  }, [user, setStoredUser]);
  
  return {
    user,
    loading,
    error,
    login,
    logout,
    fetchUserBalance,
  };
} 