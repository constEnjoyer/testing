'use client';

import React, { useEffect, useRef } from 'react';
import styles from '../styles/components.module.css';
import { useTranslations } from 'next-intl';

interface CountdownOverlayProps {
  isVisible: boolean;
  countdown: number;
  opponentName?: string;
  onCountdownComplete?: () => void;
}

/**
 * Компонент для отображения обратного отсчета перед началом игры
 * Получает значение отсчета извне и вызывает onCountdownComplete по достижении нуля
 */
const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ 
  isVisible, 
  countdown,
  opponentName,
  onCountdownComplete
}) => {
  const i18n = useTranslations('i18n');
  const prevCountdownRef = useRef(countdown);
  
  // Отслеживаем изменение значения отсчета
  useEffect(() => {
    // Если компонент не видим, ничего не делаем
    if (!isVisible) return;
    
    console.log('[CountdownOverlay] Значение отсчета:', countdown);
    
    // Если счетчик достиг нуля и это новое значение (было > 0)
    if (countdown === 0 && prevCountdownRef.current > 0) {
      console.log('[CountdownOverlay] Отсчет завершен, вызываем onCountdownComplete');
      if (onCountdownComplete) {
        onCountdownComplete();
      }
    }
    
    // Сохраняем предыдущее значение для сравнения
    prevCountdownRef.current = countdown;
  }, [isVisible, countdown, onCountdownComplete]);
  
  // Не отображаем, если компонент должен быть скрыт
  if (!isVisible) {
    return null;
  }
  
  return (
    <div 
      className={styles.overlayContainer}
      data-testid="countdown-overlay"
    >
      <div className={styles.countdownContainer}>
        <h2 className={styles.countdownTitle}>{i18n('opponent_found')}</h2>
        
        {opponentName && (
          <p className={styles.opponentName}>
            {i18n('opponent')}: {opponentName}
          </p>
        )}
        
        <div className={styles.countdownValue}>
          {countdown}
        </div>
        
        <p className={styles.countdownText}>
          {i18n('game_starts_in', { seconds: countdown })}
        </p>
      </div>
    </div>
  );
};

export default CountdownOverlay; 