'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import styles from './UserBalance.module.css';
import { useUser } from '@/contexts/UserContext';
import { useSignal, initData } from '@telegram-apps/sdk-react';

/**
 * Компонент для отображения баланса пользователя
 * напрямую получает данные из MongoDB через API
 */
export function UserBalance() {
  const { balance: contextBalance, fetchUserData, isLoading: contextLoading } = useUser();
  
  // Локальное состояние для баланса, полученного напрямую
  const [directBalance, setDirectBalance] = useState({
    chance: 0,
    tonotChance: 0,
    tonot: 0,
    ton: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Получаем данные пользователя из Telegram Mini Apps
  const initDataState = useSignal(initData.state);
  const user = initDataState?.user;
  
  // Функция для прямого получения баланса из API
  const fetchDirectBalance = useCallback(async () => {
    if (!user?.id) {
      console.log('[UserBalance] Нет данных пользователя Telegram для прямого запроса баланса');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[UserBalance] Прямой запрос баланса для пользователя:', user.id);
      
      // Добавляем случайный параметр для избегания кэширования
      const cacheKey = Date.now();
      const response = await fetch(`/api/user-data?telegramId=${user.id}&_cache=${cacheKey}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[UserBalance] Ошибка при получении данных:', errorText);
        setError(`Ошибка получения данных: ${errorText}`);
        return;
      }
      
      const data = await response.json();
      console.log('[UserBalance] Получен прямой ответ API:', data);
      
      // Обработка успешного ответа
      if (data.success && data.data) {
        const newBalance = {
          chance: Number(data.data.tickets) || 0,
          tonotChance: Number(data.data.tonotChanceTickets) || 0,
          tonot: Number(data.data.balance) || 0,
          ton: Number(data.data.tonBalance) || 0
        };
        
        console.log('[UserBalance] Установка прямого баланса:', newBalance);
        setDirectBalance(newBalance);
      } else {
        console.error('[UserBalance] Некорректный формат данных:', data);
        // Если ответ некорректный, используем баланс из контекста
        setDirectBalance(contextBalance);
      }
    } catch (error) {
      console.error('[UserBalance] Ошибка при получении баланса:', error);
      setError('Ошибка при получении баланса');
      // При ошибке используем баланс из контекста
      setDirectBalance(contextBalance);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, contextBalance]);
  
  // Запрашиваем баланс при монтировании и каждые 5 секунд
  useEffect(() => {
    console.log('[UserBalance] Инициализация компонента');
    
    // Первоначальный запрос баланса
    fetchDirectBalance();
    
    // Настраиваем интервал для периодического обновления
    const interval = setInterval(() => {
      console.log('[UserBalance] Периодическое обновление прямого баланса');
      fetchDirectBalance();
    }, 5000); // Каждые 5 секунд
    
    return () => {
      console.log('[UserBalance] Очистка интервала обновления баланса');
      clearInterval(interval);
    };
  }, [user, fetchDirectBalance]); // Запускаем при изменении пользователя или метода fetchDirectBalance
  
  // Для визуализации используем прямой баланс, если он есть, иначе из контекста
  const displayBalance = {
    chance: directBalance.chance || contextBalance.chance || 0,
    tonotChance: directBalance.tonotChance || contextBalance.tonotChance || 0,
    tonot: directBalance.tonot || contextBalance.tonot || 0,
    ton: directBalance.ton || contextBalance.ton || 0
  };
  
  // Форматирование чисел для отображения
  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) return '0';
    
    // Для чисел больше 1000 добавляем сокращение k
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    
    return String(value);
  };

  return (
    <div className={styles.balanceBar}>
      <div className={styles.balanceItem}>
        <div className={styles.balanceIcon}>
          <Image 
            src="/images/tickets.png" 
            alt="Chance" 
            width={20} 
            height={20}
            className="spinning-infinite"
          />
        </div>
        <span>{formatNumber(displayBalance.chance)}</span>
      </div>
      <div className={styles.balanceItem}>
        <div className={styles.balanceIcon}>
          <Image 
            src="/images/tonot.png" 
            alt="TONOT" 
            width={20} 
            height={20}
            className="spinning-infinite"
          />
        </div>
        <span>{formatNumber(displayBalance.tonot)}</span>
      </div>
      <div className={styles.balanceItem}>
        <div className={styles.balanceIcon}>
          <Image 
            src="/images/tonot-chance.png" 
            alt="TONOT Chance" 
            width={20} 
            height={20}
            className="spinning-infinite"
          />
        </div>
        <span>{formatNumber(displayBalance.tonotChance)}</span>
      </div>
      <div className={styles.balanceItem}>
        <div className={styles.balanceIcon}>
          <Image 
            src="/images/TON.png" 
            alt="TON" 
            width={20} 
            height={20}
            className="spinning-infinite"
          />
        </div>
        <span>{Number(displayBalance.ton || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}

export default UserBalance; 