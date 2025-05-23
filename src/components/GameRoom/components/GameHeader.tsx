'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import styles from '../styles/GameHeader.module.css';
import Image from 'next/image';

// Локальный тип для баланса
interface Balance {
  chance: number;
  tonotChance: number;
  tonot: number;
  ton: number;
}

interface GameHeaderProps {
  balance: {
    chance: number;
    tonotChance: number;
    tonot: number;
    ton: number;
  };
}

/**
 * Компонент GameHeader - заголовок игровой комнаты с отображением баланса
 * Получает баланс через props из контейнера
 */
export const GameHeader: React.FC<GameHeaderProps> = ({ balance }) => {
  const i18n = useTranslations('i18n');  // Используем правильный namespace
  
  // Форматирование чисел для отображения
  const formatNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '0';
    
    // Преобразуем в число, если это строка
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Проверка на NaN
    if (isNaN(numValue)) return '0';
    
    // Для чисел больше 1000 добавляем сокращение k
    if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}k`;
    }
    
    return String(numValue);
  };

  return (
    <div className={styles.header}>
      <div className={styles.titleWrapper}>
        <h1 className={styles.title}>{i18n('tonotchance')}</h1>
        <p className={styles.subtitle}>{i18n('tagline')}</p>
      </div>
      
      {/* Показ баланса в игровой комнате */}
      <div className={styles.balancePanel}>
        <div className={styles.balanceItem}>
          <Image 
            src="/images/tickets.png" 
            alt={i18n('chance_tickets')} 
            width={16} 
            height={16} 
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.chance)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image 
            src="/images/tonot-chance.png" 
            alt={i18n('tonot_chance_tickets')} 
            width={16} 
            height={16} 
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.tonotChance)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image 
            src="/images/tonot.png" 
            alt={i18n('tonot_coins')} 
            width={16} 
            height={16} 
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.tonot)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image 
            src="/images/TON.png" 
            alt={i18n('ton_coin')} 
            width={25} 
            height={25} 
          />
          <span className={styles.balanceValue}>
            {typeof balance?.ton === 'number' && !isNaN(balance?.ton) 
              ? balance.ton.toFixed(2) 
              : typeof balance?.ton === 'string' && !isNaN(parseFloat(balance.ton)) 
                ? parseFloat(balance.ton).toFixed(2) 
                : '0.00'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameHeader; 