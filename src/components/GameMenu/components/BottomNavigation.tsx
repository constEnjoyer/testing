import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import styles from './BottomNavigation.module.css';

export enum ScreenType {
  HOME = 'home',
  TICKETS = 'tickets',
  EXCHANGE = 'exchange',
  HISTORY = 'history',
  GAME_ROOM = 'game_room'
}

interface BottomNavigationProps {
  activeScreen: ScreenType;
  onScreenChange: (screen: ScreenType) => void;
  onHomeClick?: () => void;
  isHypnoMode?: boolean;
}

export function BottomNavigation({ 
  activeScreen, 
  onScreenChange, 
  onHomeClick,
  isHypnoMode = false 
}: BottomNavigationProps) {
  const t = useTranslations('menu');
  
  // Проверяем, нужно ли скрыть навигацию в гипно-режиме
  const navClasses = [
    styles.bottomNav,
    isHypnoMode ? styles.hiddenInHypnoMode : '',
  ].join(' ').trim();
  
  // Обработчик для кнопки Home
  const handleHomeClick = () => {
    if (onHomeClick) {
      onHomeClick();
    } else {
      onScreenChange(ScreenType.HOME);
    }
  };
  
  return (
    <div className={navClasses}>
      <div 
        className={`${styles.bottomNavItem} ${activeScreen === ScreenType.HOME ? styles.active : ''}`}
        onClick={handleHomeClick}
      >
        <div className={styles.bottomNavIcon}>
          <Image 
            src="/images/main-hypno-wheel.png" 
            alt={t('home')} 
            width={24} 
            height={24}
          />
        </div>
        <div className={styles.bottomNavText}>{t('home')}</div>
      </div>
      
      <div 
        className={`${styles.bottomNavItem} ${activeScreen === ScreenType.TICKETS ? styles.active : ''}`}
        onClick={() => onScreenChange(ScreenType.TICKETS)}
      >
        <div className={styles.bottomNavIcon}>
          <Image 
            src="/images/tickets.png" 
            alt={t('chance')} 
            width={24} 
            height={24} 
          />
        </div>
        <div className={styles.bottomNavText}>{t('chance')}</div>
      </div>
      
      <div 
        className={`${styles.bottomNavItem} ${activeScreen === ScreenType.EXCHANGE ? styles.active : ''}`}
        onClick={() => onScreenChange(ScreenType.EXCHANGE)}
      >
        <div className={`${styles.bottomNavIcon} ${styles.exchangeIconsContainer}`}>
          <Image 
            src="/images/TON.png" 
            alt="TON" 
            width={20} 
            height={20} 
            className={styles.exchangeNavIcon} 
          />
          <span className={styles.exchangeArrow}>↔</span>
          <Image 
            src="/images/tonot.png" 
            alt="TONOT" 
            width={20} 
            height={20} 
            className={styles.exchangeNavIcon} 
          />
        </div>
        <div className={styles.bottomNavText}>{t('alchemy')}</div>
      </div>
      
      <div 
        className={`${styles.bottomNavItem} ${activeScreen === ScreenType.HISTORY ? styles.active : ''}`}
        onClick={() => onScreenChange(ScreenType.HISTORY)}
      >
        <div className={`${styles.bottomNavIcon} ${styles.historyIconsRow}`}>
          <Image 
            src="/images/tickets.png" 
            alt={t('chance')} 
            width={12} 
            height={12} 
            className={styles.historyToken} 
          />
          <Image 
            src="/images/TON.png" 
            alt="TON" 
            width={12} 
            height={12} 
            className={styles.historyToken} 
          />
          <Image 
            src="/images/tonot.png" 
            alt="TONOT" 
            width={12} 
            height={12} 
            className={styles.historyToken} 
          />
        </div>
        <div className={styles.bottomNavText}>{t('history')}</div>
      </div>
    </div>
  );
}

export default BottomNavigation; 