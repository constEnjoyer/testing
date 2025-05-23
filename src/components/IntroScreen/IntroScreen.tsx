'use client';

import React, { useState, useEffect, useContext } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import styles from './IntroScreen.module.css';
import { SoundContext } from '@/components/Root/Root';

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const t = useTranslations('i18n');
  const { playIntroSound } = useContext(SoundContext);
  const [animationStage, setAnimationStage] = useState(0);
  // 0 - начальное состояние
  // 1 - монета исчезает
  // 2 - кулисы появляются
  // 3 - кулисы раздвигаются
  // 4 - интро исчезает

  // Запускаем анимацию при нажатии на экран
  const handleClick = () => {
    if (animationStage === 0) {
      // Воспроизводим звук интро
      playIntroSound();
      
      // Запускаем исчезновение монеты
      setAnimationStage(1);
      
      // Через 1 секунду показываем кулисы
      setTimeout(() => {
        setAnimationStage(2);
        
        // Через 0.3 секунды запускаем анимацию раздвижения кулис
        setTimeout(() => {
          setAnimationStage(3);
          
          // Через 2 секунды (когда кулисы полностью раздвинуты) начинаем исчезновение интро
          setTimeout(() => {
            setAnimationStage(4);
            
            // Через 0.5 секунды вызываем onComplete для показа меню
            setTimeout(() => {
              onComplete();
            }, 500);
          }, 2000);
        }, 300);
      }, 1000);
    }
  };
  
  // Классы для анимации
  const introClasses = `${styles.screen} ${animationStage >= 4 ? styles.fadeOut : animationStage >= 1 ? styles.animating : ''}`;
  const coinClasses = `${styles.coin} ${animationStage >= 1 ? styles.coinAnimate : ''}`;
  const chanceClasses = `${styles.chance} ${animationStage >= 1 ? styles.chanceAnimate : ''}`;
  
  return (
    <div className={introClasses} onClick={handleClick}>
      <div className={styles.content}>
        <div className={coinClasses}>
          <Image
            src="/images/tonot.png"
            alt="TONOT Coin"
            width={200}
            height={200}
            priority
          />
        </div>
        <div className={chanceClasses}>
          <h2>TONOT CHANCE</h2>
        </div>
      </div>
      
      {animationStage === 0 && (
        <div className={styles.tapHint}>
          <p>{t('tap_to_start')}</p>
        </div>
      )}
      
      {animationStage >= 2 && animationStage <= 3 && (
        <div className={styles.curtains}>
          <div className={styles.curtainLeft}></div>
          <div className={styles.curtainRight}></div>
        </div>
      )}
    </div>
  );
};

export default IntroScreen; 