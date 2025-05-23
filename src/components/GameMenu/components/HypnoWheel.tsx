'use client';

import React, { useEffect, useRef } from 'react';
import styles from './HypnoWheel.module.css';
import Image from 'next/image';

interface HypnoWheelProps {
  isHypnoMode: boolean;
  toggleHypnoMode: () => void;
}

/**
 * Компонент гипнотического колеса
 * Теперь также служит для переключения гипно-режима при клике
 */
export function HypnoWheel({ isHypnoMode, toggleHypnoMode }: HypnoWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Блокируем прокрутку страницы в режиме гипноза
  useEffect(() => {
    // Проверяем, что мы в браузере и document существует
    if (typeof window === 'undefined' || !document?.body) {
      return;
    }

    try {
      if (isHypnoMode) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      // Очистка при размонтировании
      return () => {
        if (document?.body) {
          document.body.style.overflow = '';
        }
      };
    } catch (error) {
      console.error('Error manipulating DOM in HypnoWheel:', error);
    }
  }, [isHypnoMode]);

  const containerClasses = [
    styles.hypnoWheelContainer,
    'hypno-wheel-container',
    isHypnoMode ? styles.hypnoModeActive : '',
  ].join(' ').trim();

  return (
    <div className={containerClasses} onClick={toggleHypnoMode} ref={containerRef}>
      <div className={styles.hypnoWheelWrapper}>
        <Image 
          src="/images/main-hypno-wheel.png" 
          alt="Hypnotic Wheel" 
          width={300} 
          height={300}
          className={styles.hypnoWheel}
          priority={true}
        />
      </div>
    </div>
  );
}

export default HypnoWheel; 