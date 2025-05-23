import { useState, useEffect } from 'react';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import type { TelegramUser } from '@telegram-apps/sdk-react';

/**
 * Хук для получения данных пользователя Telegram
 * @returns Объект с данными пользователя Telegram из Mini App
 */
export function useTelegramUser() {
  const initDataState = useSignal(initData.state);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  
  useEffect(() => {
    if (initDataState?.user) {
      setTelegramUser(initDataState.user);
    }
  }, [initDataState]);
  
  return { telegramUser };
} 