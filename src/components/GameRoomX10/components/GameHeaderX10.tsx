'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import styles from './styles/GameHeaderX10.module.css';

interface Balance {
  chance: number;              // Активные билеты
  tonotChance: number;        // Пассивные билеты
  tonot: number;
  ton: number;
}

interface GameHeaderX10Props {
  balance: Balance;
}

/**
 * Компонент GameHeaderX10 - заголовок игровой комнаты X10
 */
const GameHeaderX10: React.FC<GameHeaderX10Props> = ({ balance }) => {
  const t = useTranslations('game');
  const i18n = useTranslations('i18n');
  
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
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>{t('x10.temple_title')}</h1>
        <p className={styles.subtitle}>{t('x10.temple_subtitle')}</p>
      </div>
      
      {/* Показ баланса в игровой комнате */}
      <div className={styles.balancePanel}>
        <div className={styles.balanceItem}>
          <Image
            src="/images/tickets.png"
            alt={i18n('chance_tickets')}
            width={32}
            height={32}
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.chance)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image
            src="/images/tonot-chance.png"
            alt={i18n('tonot_chance_tickets')}
            width={32}
            height={32}
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.tonotChance)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image
            src="/images/tonot.png"
            alt={i18n('tonot_coins')}
            width={32}
            height={32}
            className={styles.tokenIcon}
          />
          <span className={styles.balanceValue}>{formatNumber(balance?.tonot)}</span>
        </div>
        
        <div className={styles.balanceItem}>
          <Image
            src="/images/TON.png"
            alt={i18n('ton_coin')}
            width={32}
            height={32}
            className={styles.tokenIcon}
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
    </header>
  );
};

export default GameHeaderX10; 