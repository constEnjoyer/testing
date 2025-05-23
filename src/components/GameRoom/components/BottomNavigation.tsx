'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import styles from '../styles/BottomNavigation.module.css';

/**
 * Типы экранов для навигации
 */
export enum ScreenType {
  HOME = 'home',
  GAME_ROOM = 'game_room',
  TICKETS = 'tickets',
  EXCHANGE = 'exchange',
  HISTORY = 'history'
}

interface BottomNavigationProps {
  activeScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  useDirectHomeNavigation?: boolean;
}

/**
 * Компонент нижней навигации для игровой комнаты
 * Отображает панель с кнопками навигации: HOME, ШАНС, АЛХИМИЯ, СВИТОК
 */
const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeScreen, 
  onNavigate,
  useDirectHomeNavigation = true
}) => {
  const t = useTranslations('menu');
  
  const handleNavigation = (screen: ScreenType) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(screen);
  };
  
  return (
    <nav className={styles.bottomNavigation}>
      {useDirectHomeNavigation ? (
        <a 
          href="#"
          className={`${styles.navButton} ${activeScreen === ScreenType.HOME ? styles.active : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(ScreenType.HOME);
          }}
        >
          <Image
            src="/images/main-hypno-wheel.png"
            alt={t('home')}
            width={24}
            height={24}
            className={styles.navIcon}
          />
          <span>{t('home')}</span>
        </a>
      ) : (
        <a 
          href="#"
          className={`${styles.navButton} ${activeScreen === ScreenType.HOME ? styles.active : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(ScreenType.HOME);
          }}
        >
          <Image
            src="/images/main-hypno-wheel.png"
            alt={t('home')}
            width={24}
            height={24}
            className={styles.navIcon}
          />
          <span>{t('home')}</span>
        </a>
      )}
      
      <a 
        href="#"
        className={`${styles.navButton} ${activeScreen === ScreenType.TICKETS ? styles.active : ''}`}
        onClick={handleNavigation(ScreenType.TICKETS)}
      >
        <Image
          src="/images/tickets.png"
          alt={t('chance')}
          width={24}
          height={24}
          className={styles.navIcon}
        />
        <span>{t('chance')}</span>
      </a>
      
      <a 
        href="#"
        className={`${styles.navButton} ${activeScreen === ScreenType.EXCHANGE ? styles.active : ''}`}
        onClick={handleNavigation(ScreenType.EXCHANGE)}
      >
        <div className={styles.exchangeIconsContainer}>
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
        <span>{t('alchemy')}</span>
      </a>
      
      <a 
        href="#"
        className={`${styles.navButton} ${activeScreen === ScreenType.HISTORY ? styles.active : ''}`}
        onClick={handleNavigation(ScreenType.HISTORY)}
      >
        <div className={styles.historyIconsRow}>
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
        <span>{t('history')}</span>
      </a>
    </nav>
  );
};

export default BottomNavigation; 