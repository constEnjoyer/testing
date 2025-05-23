import { useState, useEffect, useCallback } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { CONFIG } from '@/lib/config';

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
      // Получаем telegramId из localStorage
      const telegramData = localStorage.getItem('telegram-data');
      const telegramId = telegramData ? JSON.parse(telegramData).id : null;

      if (!telegramId) {
        console.error('[useTonConnect] Не найден telegramId в localStorage');
        return;
      }

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

      if (!response.ok) {
        throw new Error('Failed to update wallet address');
      }

      console.log('[useTonConnect] Адрес кошелька успешно обновлен в базе данных');
    } catch (err) {
      console.error('[useTonConnect] Ошибка при обновлении адреса кошелька:', err);
    }
  }, []);

  // Проверка состояния подключения при монтировании
  useEffect(() => {
    const walletConnectionStatus = () => {
      const walletInfo = tonConnectUI.wallet;
      setIsConnected(Boolean(walletInfo));
      
      if (walletInfo) {
        const newAddress = walletInfo.account.address;
        setAddress(newAddress);
        // Обновляем адрес в базе данных при подключении
        updateWalletAddress(newAddress);
      } else {
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
    // Очищаем адрес в базе данных при отключении
    updateWalletAddress('');
  }, [tonConnectUI, updateWalletAddress]);

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