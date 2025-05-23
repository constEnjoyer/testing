import React, { useEffect, useContext, FC, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './styles/ResultModalX10.module.css';
import Image from 'next/image';

interface ResultModalX10Props {
  position: number;          // Место игрока (1-10)
  prize: number | 'tonot-chance';  // Приз (ТОНОТ или TonotChance билет)
  onClose: () => void;      // Колбэк закрытия
  onBalanceUpdate?: () => void; // Колбэк обновления баланса
}

const ResultModalX10: FC<ResultModalX10Props> = ({ position, prize, onClose, onBalanceUpdate }) => {
  const t = useTranslations('i18n');
  const gameT = useTranslations('game');
  
  const [isVisible, setIsVisible] = useState(true); // Сразу показываем
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [balanceUpdated, setBalanceUpdated] = useState(false); // Флаг для отслеживания обновления баланса

  const isWinner = position > 0 && position <= 3;
  
  // Обновляем баланс только один раз при монтировании
  useEffect(() => {
    if (!balanceUpdated && onBalanceUpdate) {
      console.log('[ResultModalX10] 💰 Однократное обновление баланса');
      onBalanceUpdate();
      setBalanceUpdated(true);
    }
  }, [onBalanceUpdate, balanceUpdated]);

  // Обработчик загрузки изображения
  const handleImageLoad = () => {
    console.log('[ResultModalX10] 🖼️ Изображение загружено');
    setImagesLoaded(true);
  };

  // Получаем правильное сообщение в зависимости от позиции
  const getResultMessage = () => {
    if (!isWinner) {
      return gameT('x10_consolation');
    }
    
    switch (position) {
      case 1:
        return gameT('x10_win_first');
      case 2:
        return gameT('x10_win_second');
      case 3:
        return gameT('x10_win_third');
      default:
        return gameT('x10_consolation');
    }
  };

  // Получаем текст для отображения приза
  const getPrizeText = () => {
    if (!isWinner) {
      return gameT('x10_consolation_prize');
    }
    
    if (typeof prize === 'number') {
      return `${prize} TONOT`;
    }
    return prize === 'tonot-chance' ? gameT('x10_consolation_prize') : String(prize);
  };

  // Обработчик закрытия с защитой от двойных кликов
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVisible) return; // Защита от двойного клика
    
    setIsVisible(false);
    console.log('[ResultModalX10] ✖️ Закрытие модального окна');
    onClose();
  };

  return (
    <div 
      className={`${styles.overlay} ${isVisible ? styles.visible : ''}`} 
      onClick={handleClose}
    >
      <div 
        className={`${styles.modal} ${isWinner ? styles.winnerModal : styles.loserModal}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.content}>
          <div className={styles.imageWrapper}>
            <Image
              src={isWinner ? '/images/tonot.png' : '/images/tonot-chance.png'}
              alt={isWinner ? 'TONOT' : 'TonotChance'}
              width={200}
              height={200}
              priority
              onLoad={handleImageLoad}
              className={styles.resultImage}
            />
          </div>
          <div className={styles.text}>
            {getResultMessage()}
          </div>
          <div className={styles.prizeText}>
            {getPrizeText()}
          </div>
        </div>
        <button 
          onClick={handleClose} 
          className={styles.button}
          disabled={!isVisible} // Защита от множественных кликов
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
};

export default ResultModalX10; 