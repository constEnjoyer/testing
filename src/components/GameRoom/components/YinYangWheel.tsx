'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from '../styles/YinYangWheel.module.css';

interface YinYangWheelProps {
  isSpinning: boolean;
  onSpinComplete?: () => void;
  duration?: number; // длительность вращения в мс
}

/**
 * Компонент YinYangWheel - вращающееся колесо Инь-Янь
 * Реагирует на внешнее состояние isSpinning и вызывает onSpinComplete по окончании вращения
 */
const YinYangWheel: React.FC<YinYangWheelProps> = ({ 
  isSpinning, 
  onSpinComplete,
  duration = 5000 // Обновляем до 5 секунд
}) => {
  // Храним предыдущее состояние для отслеживания изменений
  const wasSpinningRef = useRef(false);
  
  // Используем таймер для отслеживания завершения вращения
  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Новая переменная для отслеживания состояния вращения
  const spinningRef = useRef(false);
  
  // Отслеживаем изменения состояния вращения
  useEffect(() => {
    // Начало вращения (переход из false в true)
    if (isSpinning && !wasSpinningRef.current) {
      console.log('[YinYangWheel] 🎲 Начало вращения колеса');
      
      // Помечаем, что колесо сейчас вращается
      spinningRef.current = true;
      
      // Очищаем существующий таймер, если есть
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      
      // Устанавливаем таймер для завершения вращения
      spinTimerRef.current = setTimeout(() => {
        console.log('[YinYangWheel] 🎯 Вращение колеса завершено');
        spinningRef.current = false;
        if (onSpinComplete) {
          // Вызываем onSpinComplete с небольшой задержкой
          // чтобы анимация успела завершиться
          setTimeout(onSpinComplete, 100);
        }
      }, duration); // Используем duration для синхронизации с CSS анимацией
      
      // Добавляем таймаут безопасности
      const safetyTimeout = setTimeout(() => {
        if (spinningRef.current) {
          console.log('[YinYangWheel] ⚠️ Принудительное завершение вращения');
          spinningRef.current = false;
          if (spinTimerRef.current) {
            clearTimeout(spinTimerRef.current);
            spinTimerRef.current = null;
          }
          if (onSpinComplete) onSpinComplete();
        }
      }, duration + 1000); // Даем дополнительную секунду
      
      return () => {
        clearTimeout(safetyTimeout);
      };
    }
    
    // Обновляем ref для следующего вызова
    wasSpinningRef.current = isSpinning;
    
    // Очистка при размонтировании
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
    };
  }, [isSpinning, duration, onSpinComplete]);

  return (
    <div className={styles.wheelContainer}>
      <div 
        className={`${styles.wheel} ${isSpinning ? styles.spinning : ''}`}
        style={{ 
          willChange: 'transform',
          // Добавляем плавное завершение вращения
          transition: isSpinning ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        <Image 
          src="/images/yin-yang-wheel.png"
          alt="Yin Yang Wheel"
          width={280}
          height={280}
          priority
          className={styles.wheelImage}
        />
      </div>
      <div className={styles.purpleGlow}></div>
    </div>
  );
};

export default YinYangWheel; 