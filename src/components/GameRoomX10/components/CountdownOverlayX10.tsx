import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import styles from './styles/CountdownOverlayX10.module.css';

const COUNTDOWN_FROM = 5; // 5 секунд на подготовку

interface CountdownOverlayX10Props {
  onComplete: () => void;
}

export default function CountdownOverlayX10({ onComplete }: CountdownOverlayX10Props) {
  const t = useTranslations('game');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [onComplete]);
  
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.countdownContainer}>
          <div className={styles.countdownNumber}>
            {countdown}
          </div>
          <div className={styles.countdownText}>
            {t('x10.countdown_text')}
          </div>
        </div>
      </div>
    </div>
  );
} 