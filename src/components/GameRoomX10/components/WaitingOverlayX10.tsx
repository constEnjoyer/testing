import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './styles/WaitingOverlayX10.module.css';

interface WaitingOverlayX10Props {
  onClose: () => void;
  message: string;
}

export default function WaitingOverlayX10({ 
  onClose,
  message
}: WaitingOverlayX10Props) {
  const t = useTranslations('i18n');
  
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        {/* Сообщение о поиске */}
        <div className={styles.searchMessage}>
          {message}
        </div>

        {/* Спиннер загрузки */}
        <div className={styles.spinner} />

        {/* Кнопка закрытия окна */}
        <button 
          className={styles.closeButton}
          onClick={onClose}
        >
          {t('close_window')}
        </button>
      </div>
    </div>
  );
} 