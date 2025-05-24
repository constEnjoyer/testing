import { useState, useEffect, useCallback } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { CONFIG } from '@/lib/config';
import { STORAGE_KEYS } from '@/utils/storageUtils';

// Добавляем типы для Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe: {
          user?: {
            id: number;
            [key: string]: any;
          };
          [key: string]: any;
        };
        [key: string]: any;
      };
    };
  }
}

/**
 * Хук для работы с TON Connect
 * Использует реальное подключение к кошельку TON через TonConnectUI
 */
export function useTonConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Функция для обновления адреса кошелька в базе данных
  const updateWalletAddress = useCallback(async (walletAddress: string) => {
    try {
      // Пытаемся получить telegramId из разных источников
      let telegramId = null;
      
      // 1. Пробуем получить из window.Telegram.WebApp
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        telegramId = window.Telegram.WebApp.initDataUnsafe.user.id;
        console.log('[useTonConnect] Получен telegramId из WebApp:', telegramId);
      }
      
      // 2. Если нет, пробуем из localStorage
      if (!telegramId) {
        const telegramData = localStorage.getItem('telegram-data');
        if (telegramData) {
          try {
            const parsedData = JSON.parse(telegramData);
            if (parsedData.id) {
              telegramId = parsedData.id;
              console.log('[useTonConnect] Получен telegramId из localStorage:', telegramId);
            }
          } catch (e) {
            console.error('[useTonConnect] Ошибка парсинга telegram-data:', e);
          }
        }
      }
      
      // 3. Пробуем получить из STORAGE_KEYS.TELEGRAM_USER_ID
      if (!telegramId) {
        const storedId = localStorage.getItem(STORAGE_KEYS.TELEGRAM_USER_ID);
        if (storedId) {
          telegramId = parseInt(storedId, 10);
          console.log('[useTonConnect] Получен telegramId из STORAGE_KEYS:', telegramId);
        }
      }

      if (!telegramId) {
        console.error('[useTonConnect] Не удалось получить telegramId');
        return;
      }

      // Добавляем дополнительную проверку на валидность адреса
      if (!walletAddress || walletAddress.length < 10) {
        console.error('[useTonConnect] Некорректный адрес кошелька:', walletAddress);
        return;
      }

      console.log('[useTonConnect] Отправка запроса на обновление с данными:', {
        telegramId,
        walletAddress
      });

      // Делаем три попытки отправки запроса
      let attempts = 3;
      let success = false;
      let lastError = null;

      while (attempts > 0 && !success) {
        try {
          const response = await fetch('/api/user-data/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              telegramId,
              walletAddress
            }),
          });

          const responseData = await response.json();
          
          if (response.ok && responseData.success) {
            console.log('[useTonConnect] Адрес кошелька успешно обновлен в базе данных');
            success = true;
            break;
          } else {
            throw new Error(responseData.error || 'Неизвестная ошибка');
          }
        } catch (err) {
          lastError = err;
          console.error(`[useTonConnect] Попытка ${4 - attempts} обновления адреса кошелька не удалась:`, err);
          attempts--;
          if (attempts > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем секунду перед следующей попыткой
          }
        }
      }

      if (!success && lastError) {
        throw lastError;
      }
    } catch (err) {
      console.error('[useTonConnect] Критическая ошибка при обновлении адреса кошелька:', err);
    }
  }, []);

  // Проверка состояния подключения при монтировании
  useEffect(() => {
    const walletConnectionStatus = () => {
      const walletInfo = tonConnectUI.wallet;
      console.log('[useTonConnect] Информация о кошельке:', walletInfo);
      
      setIsConnected(Boolean(walletInfo));
      
      if (walletInfo) {
        const newAddress = walletInfo.account.address;
        console.log('[useTonConnect] Получен новый адрес:', newAddress);
        setAddress(newAddress);
        // Обновляем адрес в базе данных при подключении
        updateWalletAddress(newAddress);
      } else {
        console.log('[useTonConnect] Кошелек отключен');
        setAddress(null);
      }
    };
    
    // Инициализируем состояние
    walletConnectionStatus();
    
    // Подписываемся на изменения состояния кошелька
    const unsubscribe = tonConnectUI.onStatusChange(walletConnectionStatus);
    
    return () => {
      // Отписываемся при размонтировании
      unsubscribe();
    };
  }, [tonConnectUI, updateWalletAddress]);

  // Подключение к кошельку
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await tonConnectUI.connectWallet();
      return true;
    } catch (err: any) {
      console.error('[useTonConnect] Ошибка подключения к кошельку:', err);
      setError(err.message || 'Ошибка подключения к кошельку');
      return false;
    } finally {
      setLoading(false);
    }
  }, [tonConnectUI]);

  // Отключение от кошелька
  const disconnect = useCallback(() => {
    if (tonConnectUI.wallet) {
      tonConnectUI.disconnect();
    }
    setIsConnected(false);
    setAddress(null);
    // При отключении не обновляем адрес в базе данных
  }, [tonConnectUI]);

  // Отправка транзакции
  const sendTransaction = useCallback(async (amount: number, toAddress: string) => {
    console.log('[useTonConnect] Отправка транзакции:', { amount, toAddress });
    
    if (!tonConnectUI.wallet) {
      throw new Error('Кошелёк не подключен');
    }
    
    // Создаем транзакцию
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // Валидна 5 минут
      messages: [
        {
          address: toAddress,
          amount: (amount * 1_000_000_000).toString(), // Конвертируем в нано-TON
        },
      ],
    };
    
    // Отправляем транзакцию и возвращаем результат
    try {
      const result = await tonConnectUI.sendTransaction(transaction);
      console.log('[useTonConnect] Транзакция отправлена:', result);
      return result;
    } catch (error) {
      console.error('[useTonConnect] Ошибка отправки транзакции:', error);
      throw error;
    }
  }, [tonConnectUI]);

  return {
    isConnected,
    address,
    loading,
    error,
    connect,
    disconnect,
    sendTransaction
  };
} 