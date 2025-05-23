import React from 'react';
import styles from './ControlButtons.module.css';
import { useTranslations } from 'next-intl';
import LanguageToggle from './LanguageToggle';

interface ControlButtonsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onRefresh: () => void;
}

export function ControlButtons({ 
  isMuted, 
  onToggleMute, 
  onRefresh 
}: ControlButtonsProps) {
  const t = useTranslations('i18n');
  
  return (
    <div className={styles.controlButtonsContainer}>
      {/* Кнопка звука */}
      <button 
        className={`${styles.controlButton} ${styles.soundButton}`}
        onClick={onToggleMute}
        aria-label={isMuted ? t('unmute_sound') : t('mute_sound')}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      
      {/* Кнопка обновления баланса */}
      <button 
        className={`${styles.controlButton} ${styles.refreshButton}`}
        onClick={onRefresh}
        aria-label="Обновить баланс"
      >
        <span role="img" aria-label="Обновить">🔄</span>
      </button>
      
      {/* Переключатель языка */}
      <LanguageToggle />
    </div>
  );
}

export default ControlButtons; 