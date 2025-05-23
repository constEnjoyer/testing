'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import styles from '../styles/components.module.css';

interface WaitingOverlayProps {
  onCancelWaiting: () => Promise<void>;
  waitingStartTime: number | null;
}

export const WaitingOverlay: React.FC<WaitingOverlayProps> = ({
  onCancelWaiting,
  waitingStartTime
}) => {
  const t = useTranslations('i18n');
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [waitingTime, setWaitingTime] = useState(0);
  
  // Определяем текущий язык через URL
  const isEnglish = typeof window !== 'undefined' && 
                    window.location.pathname.startsWith('/en');
  
  // Обновляем время ожидания каждую секунду
  useEffect(() => {
    if (!waitingStartTime) return;
    
    const intervalId = setInterval(() => {
      const seconds = Math.floor((Date.now() - waitingStartTime) / 1000);
      setWaitingTime(seconds);
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [waitingStartTime]);

  const handleCancelClick = async () => {
    setIsCancelling(true);
    setCancelError(null);
    
    try {
      console.log('[WaitingOverlay] Нажата кнопка отмены поиска');
      await onCancelWaiting();
      console.log('[WaitingOverlay] Поиск успешно отменен');
    } catch (error) {
      console.error('[WaitingOverlay] Ошибка при отмене поиска:', error);
      setCancelError(t('cancel_error'));
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className={styles.waitingOverlay}>
      <div className={styles.waitingContent}>
        <div className={styles.waitingAnimation}>
          <div className={styles.loader} />
        </div>
        <h2 className={styles.waitingTitle}>{t('waiting_opponent')}</h2>
        {waitingTime > 0 && (
          <p className={styles.waitingTime}>
            {isEnglish 
              ? `Search time: ${waitingTime} sec.` 
              : `Время поиска: ${waitingTime} сек.`}
          </p>
        )}
        {cancelError && (
          <p className={styles.errorMessage}>{cancelError}</p>
        )}
        <button
          onClick={handleCancelClick}
          className={styles.cancelButton}
          disabled={isCancelling}
        >
          {isCancelling ? (isEnglish ? 'Cancelling...' : 'Отмена...') : t('cancel_waiting')}
        </button>
      </div>
    </div>
  );
}; 