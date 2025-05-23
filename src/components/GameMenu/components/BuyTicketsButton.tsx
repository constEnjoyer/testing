'use client';

import { useContext } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@telegram-apps/telegram-ui';
import { SoundContext } from '@/components/Root/Root';
import styles from './BuyTicketsButton.module.css';

interface BuyTicketsButtonProps {
  onClick: () => void;
}

/**
 * Компонент кнопки покупки билетов
 */
export const BuyTicketsButton: React.FC<BuyTicketsButtonProps> = ({ onClick }) => {
  const { playClickSound } = useContext(SoundContext);
  const t = useTranslations('i18n');
  
  const handleClick = () => {
    playClickSound();
    onClick();
  };
  
  return (
    <Button
      className={styles.buyTicketsButton}
      onClick={handleClick}
      size="m"
      style={{ marginTop: '8px', marginBottom: '8px', paddingTop: '8px', paddingBottom: '8px' }}
    >
      <span>{t('buy_tickets')}</span>
    </Button>
  );
};

export default BuyTicketsButton; 