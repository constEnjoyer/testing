'use client';

import { useContext, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SoundContext } from '@/components/Root/Root';
import styles from './WelcomeMessage.module.css';
import { CredoModal } from './CredoModal';

/**
 * Компонент для отображения приветственного сообщения
 */
export const WelcomeMessage: React.FC = () => {
  const { playClickSound, playCredoSound, stopCredoSound } = useContext(SoundContext);
  const t = useTranslations('i18n');
  const [isCredoModalOpen, setIsCredoModalOpen] = useState(false);
  
  const handleWelcomeClick = () => {
    playClickSound();
    setIsCredoModalOpen(true);
  };
  
  const handleCloseCredoModal = () => {
    playClickSound();
    stopCredoSound();
    setIsCredoModalOpen(false);
  };
  
  return (
    <div className={styles.welcomeMessageContainer}>
      {/* Приветственное сообщение */}
      <div className={styles.welcomeMessage} onClick={handleWelcomeClick}>
        <h1>{t('welcome')}</h1>
        <h2>TONOTCHANCE</h2>
        <p>{t('tagline')}</p>
      </div>
      
      {/* Модальное окно с Кредо игры */}
      <CredoModal
        isOpen={isCredoModalOpen}
        onClose={handleCloseCredoModal}
        playCredoSound={playCredoSound}
        stopCredoSound={stopCredoSound}
      />
    </div>
  );
};

export default WelcomeMessage; 