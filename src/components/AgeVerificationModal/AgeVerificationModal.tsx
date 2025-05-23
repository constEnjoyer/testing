import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './styles/AgeVerificationModal.module.css';

interface AgeVerificationModalProps {
  onConfirm: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  onConfirm
}) => {
  const t = useTranslations('common');

  // Предотвращаем закрытие по клику на оверлей
  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.content}>
          <h2 className={styles.title}>
            {t('age_verification.title')}
          </h2>
          
          <p className={styles.message}>
            {t('age_verification.message')}
          </p>

          <div className={styles.warning}>
            {t('age_verification.warning')}
          </div>

          <div className={styles.buttons}>
            <button 
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              {t('age_verification.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeVerificationModal; 