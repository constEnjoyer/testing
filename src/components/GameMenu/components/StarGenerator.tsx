import React, { useMemo } from 'react';
import styles from './StarGenerator.module.css';

interface StarGeneratorProps {
  starCount?: number;
}

export function StarGenerator({ starCount = 150 }: StarGeneratorProps) {
  // Мемоизируем звезды, чтобы они не перерисовывались при каждом рендере
  const stars = useMemo(() => {
    return Array.from({ length: starCount }).map((_, index) => {
      const size = Math.random() * 2 + 1;
      const opacity = Math.random() * 0.8 + 0.2;
      const animationDelay = Math.random() * 5;
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      
      const style = {
        width: `${size}px`,
        height: `${size}px`,
        opacity,
        left: `${left}%`,
        top: `${top}%`,
        animationDelay: `${animationDelay}s`,
      };
      
      return (
        <div
          key={index}
          className={styles.star}
          style={style}
        />
      );
    });
  }, [starCount]);
  
  return <>{stars}</>;
}

export default StarGenerator; 