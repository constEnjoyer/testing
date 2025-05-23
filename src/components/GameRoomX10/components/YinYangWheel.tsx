import React, { useRef } from 'react';
import styles from './styles/YinYangWheel.module.css';

type Phase = 'wheel_appear' | 'wheel_spin' | 'wheel_disappear';

interface YinYangWheelProps {
  phase: Phase;
}

export default function YinYangWheel({ phase }: YinYangWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef<Phase>(phase);

  // Обновляем только референс фазы для анимации
  if (prevPhaseRef.current !== phase) {
    prevPhaseRef.current = phase;
  }

  return (
    <div ref={wheelRef} className={styles.wheelContainer}>
      <div className={`${styles.wheel} ${styles[phase]}`}>
        <div className={styles.glow} />
      </div>
    </div>
  );
} 