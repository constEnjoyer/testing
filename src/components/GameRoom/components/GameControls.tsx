'use client';

import React, { useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import styles from '../styles/GameRoomContainer.module.css';
import { UserProfile, UserBalance } from '@/contexts/UserContext';

interface GameControlsProps {
  user: UserProfile | null;
  balance: UserBalance;
  isWaiting: boolean;
  isWheelSpinning: boolean;
  showCountdown: boolean;
  showGameResult: boolean;
  isLoading: boolean;
  error: string | null;
  onStartGame: (ticketsAmount: number) => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  user,
  balance,
  isWaiting,
  isWheelSpinning,
  showCountdown,
  showGameResult,
  isLoading,
  error,
  onStartGame,
}) => {
  const t = useTranslations('i18n');
  
  // Получаем количество билетов напрямую из баланса
  const availableTickets = balance?.chance || 0;
  
  // Обновляем логику isButtonDisabled
  const isButtonDisabled = useMemo(() => {
    // Упрощаем условие и проверяем только действительно важные факторы
    const isDisabled = 
      isLoading ||
      isWaiting ||
      isWheelSpinning ||
      showCountdown ||
      showGameResult ||
      availableTickets <= 0;
      
    return isDisabled;
  }, [isLoading, isWaiting, isWheelSpinning, showCountdown, showGameResult, availableTickets]);

  const handleStartGame = useCallback(() => {
    if (availableTickets > 0 && !isWaiting) {
      console.log('[GameControls] Начинаем игру');
      onStartGame(1);
    }
  }, [onStartGame, availableTickets, isWaiting]);

  return (
    <div className={styles.gameControlsContainer}>
      {/* Кнопка билет */}
      <button
        className={styles.ticketButton}
        onClick={handleStartGame}
        disabled={isButtonDisabled}
      >
        <Image
          src="/images/tickets.png"
          width={54}
          height={54}
          alt="Играть ШАНС"
          className={styles.ticketIcon}
          priority
        />
      </button>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
    </div>
  );
};

export default GameControls; 