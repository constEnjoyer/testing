'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import GameRoomContainer from '@/components/GameRoom/GameRoomContainer';
import { useUser } from '@/contexts/UserContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';

/**
 * Страница игровой комнаты (рефакторинг)
 * Используем модульный подход с разделением компонентов,
 * но сохраняем все API-вызовы и игровую логику
 * Стили перенесены в модульные CSS файлы внутри компонентов
 */

export default function GameRoomPage() {
  const t = useTranslations('i18n');
  const { user } = useUser();
  const { telegramUser } = useTelegramUser();

  // Сохраняем флаг, что мы находимся в игровой комнате x2
  useEffect(() => {
    localStorage.setItem('inGameRoom', 'true');
    return () => {
      localStorage.removeItem('inGameRoom');
    };
  }, []);

  if (!user && !telegramUser) {
    return <div>{t('loading')}</div>;
  }

  return <GameRoomContainer />;
} 