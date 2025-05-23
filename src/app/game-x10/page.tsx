'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GameRoomX10Container } from '@/components/GameRoomX10/GameRoomX10Container';
import { useUser } from '@/contexts/UserContext';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { X10RoomProvider } from '@/contexts/X10RoomContext';

export default function GameRoomX10Page() {
  const t = useTranslations('i18n');
  const { user } = useUser();
  const { telegramUser } = useTelegramUser();

  // Сохраняем флаг, что мы находимся в игровой комнате x10
  useEffect(() => {
    localStorage.setItem('inGameRoomX10', 'true');
    return () => {
      localStorage.removeItem('inGameRoomX10');
    };
  }, []);

  if (!user && !telegramUser) {
    return <div>{t('loading')}</div>;
  }

  return (
    <X10RoomProvider>
      <GameRoomX10Container />
    </X10RoomProvider>
  );
} 