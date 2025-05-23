import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { X10MatchStatus } from '@/@types/x10';
import styles from './styles/GameControlsX10.module.css';

interface GameControlsX10Props {
  onJoinRoom?: () => void;
  isLoading?: boolean;
  gameStatus?: X10MatchStatus;
  position: number;
  isBottom?: boolean;
  playerName?: string;
  isActive?: boolean;
  isMerging?: boolean;
  availableTickets?: number;
}

export default function GameControlsX10({
  onJoinRoom,
  isLoading = false,
  gameStatus = 'waiting',
  position,
  isBottom = false,
  playerName,
  isActive = false,
  isMerging = false,
  availableTickets = 0
}: GameControlsX10Props) {
  const t = useTranslations('game');
  const i18n = useTranslations('i18n');
  
  // Упрощаем логику отключения кнопки
  const isButtonDisabled = useMemo(() => {
    return !isBottom || isLoading || availableTickets <= 0;
  }, [isBottom, isLoading, availableTickets]);
  
  const handleClick = () => {
    if (!isButtonDisabled && onJoinRoom) {
      console.log('[GameControlsX10] Starting game with position:', position);
      onJoinRoom();
    }
  };
  
  return (
    <div 
      className={`
        ${styles.ticket} 
        ${isBottom ? styles.bottomTicket : ''} 
        ${isActive ? styles.active : ''} 
        ${isMerging ? styles.mergeAnimation : ''}
        ${isButtonDisabled ? styles.disabled : ''}
      `}
      onClick={handleClick}
      data-position={position}
      role={isBottom ? "button" : "presentation"}
      aria-disabled={isButtonDisabled}
      tabIndex={isBottom && !isButtonDisabled ? 0 : -1}
    >
      <div className={styles.content}>
        <div className={styles.ticketInner}>
          {/* Имя игрока показываем только если оно есть */}
          {playerName && (
            <div className={styles.playerName} aria-label={`${i18n('player_name')}: ${playerName}`}>
              {playerName}
            </div>
          )}
          
          {/* Спиннер загрузки показываем только для нижнего билета */}
          {isBottom && isLoading && (
            <div className={styles.spinner} role="progressbar" aria-label={t('loading')} />
          )}
          
          {/* Показываем сообщение о недостаточном балансе */}
          {isBottom && availableTickets <= 0 && (
            <div className={styles.noTickets} role="alert">
              {t('not_enough_tickets')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 