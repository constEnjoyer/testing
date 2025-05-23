import React, { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import styles from './GameButton.module.css';

interface GameButtonProps {
  onClick: (mode: 'x2' | 'x10') => void;
  isCleanMode?: boolean;
}

export function GameButton({ onClick, isCleanMode = false }: GameButtonProps) {
  const t = useTranslations('i18n');
  const [showModeButtons, setShowModeButtons] = useState(false);

  const handleMainButtonClick = () => {
    setShowModeButtons(!showModeButtons);
  };

  const handleModeClick = (mode: 'x2' | 'x10') => {
    onClick(mode);
    setShowModeButtons(false);
  };

  return (
    <div className={isCleanMode ? styles.gameButtonCleanMode : styles.gameButton}>
      {/* Кнопки выбора режима */}
      <div className={`${styles.modeButtons} ${showModeButtons ? styles.visible : ''}`}>
        <button 
          className={styles.modeButton}
          onClick={() => handleModeClick('x2')}
          aria-label="2 игрока"
        >
          x2
        </button>
        <button 
          className={styles.modeButton}
          onClick={() => handleModeClick('x10')}
          aria-label="10 игроков"
        >
          x10
        </button>
      </div>

      {/* Основная кнопка */}
      <button 
        className={styles.gameButtonLink}
        onClick={handleMainButtonClick}
      >
        {t('game_room')}
        <Image
          src="/images/yin-yang-wheel.png" 
          alt="Temple of Harmony"
          width={24}
          height={24}
          className={styles.templeIcon}
          priority
        />
      </button>
    </div>
  );
}

export default GameButton; 