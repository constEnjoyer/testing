'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../styles/components.module.css';
import { useTranslations } from 'next-intl';

interface ResultModalProps {
  isVisible: boolean;
  result: 'win' | 'lose' | null;
  winAmount?: number;
  onClose: () => void;
}

/**
 * Компонент для отображения результатов игры (победа/поражение)
 */
const ResultModal: React.FC<ResultModalProps> = ({
  isVisible,
  result,
  winAmount = 0,
  onClose
}) => {
  const i18n = useTranslations('i18n');
  
  // Если модальное окно не должно быть видимым или нет результата, не отображаем его
  if (!isVisible || !result) return null;
  
  return (
    <div className={styles.resultOverlay}>
      <div className={styles.resultContainer}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        {result === 'win' ? (
          <>
            <h2 className={styles.resultWin}>{i18n('you_won')}</h2>
            <div className="mt-4 mb-6">
              <Image src="/images/tonot.png" alt="TONOT" width={120} height={120} className="mx-auto" />
            </div>
            <p className={styles.resultMessage}>
              {i18n('win_description', { amount: winAmount })}
            </p>
            <button className={styles.resultButton} onClick={onClose}>
              {i18n('play_again')}
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.resultLose}>{i18n('you_lost')}</h2>
            <div className="mt-4 mb-6">
              <Image src="/images/tonot-chance.png" alt="TONOTCHANCE" width={120} height={120} className="mx-auto" />
            </div>
            <p className={styles.resultMessage}>
              {i18n('lose_description')}
            </p>
            <button className={styles.resultButton} onClick={onClose}>
              {i18n('play_again')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResultModal; 