'use client';

import React from 'react';
import styles from '../styles/components.module.css';
import { useTranslations } from 'next-intl';

interface ChanceOverlayProps {
  isVisible: boolean;
}

/**
 * Компонент, отображающий уведомление "ШАНС" на экране
 * Показывается на короткое время перед вращением колеса
 */
const ChanceOverlay: React.FC<ChanceOverlayProps> = ({ isVisible }) => {
  const t = useTranslations('i18n');
  
  // Если компонент не должен быть виден, возвращаем null
  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={styles.chanceOverlay}
      data-testid="chance-overlay"
    >
      <div className={styles.chanceButton}>
        <span className={styles.chanceText}>ШАНС</span>
      </div>
    </div>
  );
};

export default ChanceOverlay; 