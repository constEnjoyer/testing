import React, { useEffect, useRef } from 'react';
import styles from './styles/MergingAnimationX10.module.css';

interface MergingAnimationX10Props {
  onComplete: () => void;
}

// Константы для анимации (синхронизированы с CSS)
const MERGE_DURATION = 600; // Длительность одного слияния
const MERGE_PAUSE = 150;    // Пауза между слияниями
const TOTAL_DURATION = 7500; // Общая длительность всех слияний

export function MergingAnimationX10({ onComplete }: MergingAnimationX10Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const soundTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Получаем центр контейнера (символ Инь-Янь)
    const containerRect = container.getBoundingClientRect();
    const targetX = containerRect.width / 2;
    const targetY = containerRect.height / 2;

    // Обновляем CSS переменные для каждого билета
    const tickets = container.querySelectorAll(`.${styles.ticket}`);
    tickets.forEach((ticket) => {
      const ticketRect = ticket.getBoundingClientRect();
      const startX = ticketRect.left - containerRect.left + ticketRect.width / 2;
      const startY = ticketRect.top - containerRect.top + ticketRect.height / 2;
      
      ticket.setAttribute('style', `
        --start-x: ${startX}px;
        --start-y: ${startY}px;
        --target-x: ${targetX}px;
        --target-y: ${targetY}px;
      `);
    });

    // Запускаем звуки для каждого слияния
    const playSound = (index: number) => {
      console.log(`[MergingAnimation] Playing combine sound for ticket ${index + 1}`);
    };

    // Очищаем предыдущие таймеры
    soundTimersRef.current.forEach(clearTimeout);
    soundTimersRef.current = [];

    // Устанавливаем новые таймеры
    for (let i = 0; i < 10; i++) {
      const timer = setTimeout(() => {
        playSound(i);
      }, i * (MERGE_DURATION + MERGE_PAUSE));
      soundTimersRef.current.push(timer);
    }
    
    // Таймер для завершения анимации
    const completionTimer = setTimeout(() => {
      onComplete();
    }, TOTAL_DURATION);
    soundTimersRef.current.push(completionTimer);
    
    return () => {
      console.log('[MergingAnimation] Cleaning up sound timers');
      soundTimersRef.current.forEach(clearTimeout);
      soundTimersRef.current = [];
    };
  }, [onComplete]);

  return (
    <div className={`${styles.mergeContainer} ${styles.root}`}>
      <div 
        ref={containerRef}
        className={styles.ticketsContainer}
      >
        {/* Билеты расположены в порядке анимации (по часовой стрелке, начиная снизу) */}
        {Array.from({ length: 10 }).map((_, index) => (
          <div 
            key={index + 1}
            className={styles.ticket}
            data-position={index + 1}
          >
            <div className={styles.content} />
          </div>
        ))}
      </div>
    </div>
  );
} 