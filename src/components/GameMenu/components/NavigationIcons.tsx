'use client';

import { useContext } from 'react';
import { useTranslations } from 'next-intl';
import { SoundContext } from '@/components/Root/Root';
import styles from './NavigationIcons.module.css';

interface NavigationIconsProps {
  isGameRoomActive: boolean;
  isHistoryActive: boolean;
  onGameRoomClick: () => void;
  onHistoryClick: () => void;
}

/**
 * Компонент с иконками навигации
 */
export const NavigationIcons: React.FC<NavigationIconsProps> = ({
  isGameRoomActive,
  isHistoryActive,
  onGameRoomClick,
  onHistoryClick
}) => {
  const { playClickSound } = useContext(SoundContext);
  const t = useTranslations('i18n');
  
  return (
    <div className={styles.navContainer}>
      <div 
        className={`${styles.navIconItem} ${isGameRoomActive ? styles.active : ''}`} 
        onClick={() => {
          playClickSound();
          onGameRoomClick();
        }}
      >
        <div className={styles.navIcon}>
          <span className={`${styles.iconEmoji} spinning-coin`}>☯️</span>
        </div>
        <span className={styles.navText}>{t('game_room')}</span>
      </div>
      
      <div 
        className={`${styles.navIconItem} ${isHistoryActive ? styles.active : ''}`} 
        onClick={() => {
          playClickSound();
          onHistoryClick();
        }}
      >
        <div className={styles.navIcon}>
          <span className={`${styles.iconEmoji} spinning-coin`}>📜</span>
        </div>
        <span className={styles.navText}>{t('history')}</span>
      </div>
    </div>
  );
};

export default NavigationIcons; 