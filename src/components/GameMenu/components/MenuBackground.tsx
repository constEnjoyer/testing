import React from 'react';
import styles from './MenuBackground.module.css';

interface MenuBackgroundProps {
  stars: React.ReactNode;
  isCleanMode: boolean;
}

export function MenuBackground({ stars, isCleanMode }: MenuBackgroundProps) {
  return (
    <div className={`${styles.menuStarsBackground} ${isCleanMode ? styles.cleanMode : ''}`}>
      <div className={styles.coin1}></div>
      <div className={styles.coin2}></div>
      <div className={styles.coin3}></div>
      <div className={styles.coin4}></div>
      <div className={styles.coin5}></div>
      <div className={styles.coin6}></div>
      <div className={styles.coin7}></div>
      <div className={styles.coin8}></div>
      <div className={styles.coin9}></div>
      <div className={styles.coin10}></div>
      
      {/* Контейнер для звезд */}
      <div className={styles.twinklingStars}>
        {stars}
      </div>
    </div>
  );
}

export default MenuBackground; 