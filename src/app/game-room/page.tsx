'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import '../_assets/globals.css';
// Удалено: import './styles.css';

/**
 * Страница игровой комнаты (рефакторинг)
 * Используем модульный подход с разделением компонентов,
 * но сохраняем все API-вызовы и игровую логику
 * Стили перенесены в модульные CSS файлы внутри компонентов
 */

// Импортируем новый GameRoomContainer с динамической загрузкой
const GameRoomContainer = dynamic(
  () => import('@/components/GameRoom/GameRoomContainer'),
  { ssr: false }
);

export default function GameRoomPage() {
  const t = useTranslations('game');

  return (
    <Suspense fallback={<div className="loading">{t('loading')}</div>}>
      <GameRoomContainer />
    </Suspense>
  );
} 