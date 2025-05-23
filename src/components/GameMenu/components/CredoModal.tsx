'use client';

import React, { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import styles from './TicketPurchaseModal.module.css'; // Используем стили из другого модального окна

interface CredoModalProps {
  isOpen: boolean;
  onClose: () => void;
  playCredoSound: () => void;
  stopCredoSound?: () => void; // Добавляем опциональный параметр для остановки звука
}

// Функция для получения или создания портала для модальных окон
const getOrCreateModalPortal = (): HTMLElement => {
  const existingPortal = document.getElementById('modal-portal');
  if (existingPortal) {
    return existingPortal;
  }
  
  const portalElement = document.createElement('div');
  portalElement.id = 'modal-portal';
  portalElement.className = 'modal-portal';
  document.body.appendChild(portalElement);
  
  return portalElement;
};

export const CredoModal: React.FC<CredoModalProps> = ({ 
  isOpen, 
  onClose, 
  playCredoSound,
  stopCredoSound 
}) => {
  const t = useTranslations('i18n');
  const [portalElement, setPortalElement] = React.useState<HTMLElement | null>(null);
  
  // Инициализируем портал после монтирования компонента
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalElement(getOrCreateModalPortal());
    }
  }, []);
  
  // Воспроизводим звук при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      playCredoSound();
    }
    
    // Останавливаем звук при закрытии модального окна или размонтировании компонента
    return () => {
      if (stopCredoSound) {
        stopCredoSound();
      }
    };
  }, [isOpen, playCredoSound, stopCredoSound]);
  
  // Создаем обертку для обработчика закрытия, чтобы остановить звук
  const handleClose = useCallback(() => {
    if (stopCredoSound) {
      stopCredoSound();
    }
    onClose();
  }, [onClose, stopCredoSound]);
  
  // Добавляем обработчик клавиши Escape для закрытия модального окна
  // и управляем классом modal-open для скрытия других элементов
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    
    // Добавляем обработку щелчка мыши вне модального окна
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-overlay')) {
        handleClose();
      }
    };
    
    window.addEventListener('click', handleClickOutside);
    
    // Предотвращаем прокрутку фона при открытом модальном окне
    // и добавляем класс для скрытия элементов интерфейса
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = '';
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, handleClose]);
  
  if (!isOpen || !portalElement) return null;
  
  // Создаем портал для модального окна, чтобы оно рендерилось вне текущего DOM дерева
  const ModalContent = (
    <div 
      className={`${styles.ticketModal} modal-overlay`}
      onClick={handleClose}
      style={{
        zIndex: 9999, // Увеличиваем z-index до максимального значения
        position: 'fixed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.9)' // Делаем фон темнее для лучшей видимости
      }}
    >
      <div 
        className={styles.ticketModalInner} 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '90%',
          width: '450px', 
          maxHeight: '80vh',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10000, // Также увеличиваем z-index внутреннего контейнера
          overflow: 'auto',
          boxShadow: '0 0 50px rgba(138, 43, 226, 0.8)',
          border: '2px solid rgba(138, 43, 226, 0.8)',
          backgroundColor: 'rgba(25, 25, 35, 0.95)' // Делаем фон модального окна чуть более непрозрачным
        }}
      >
        <div className={styles.ticketModalHeader}>
          <h3 style={{ 
            fontSize: '26px', 
            textAlign: 'center', 
            width: '100%',
            margin: '10px 0',
            textShadow: '0 0 10px rgba(138, 43, 226, 0.7)'
          }}>
            {t('credo_title')}
          </h3>
          <button 
            className={styles.closeButton} 
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '30px',
              height: '30px',
              zIndex: 10001, // Увеличиваем z-index кнопки закрытия
              fontSize: '18px',
              cursor: 'pointer',
              background: 'rgba(138, 43, 226, 0.3)',
              border: '1px solid rgba(138, 43, 226, 0.6)',
              borderRadius: '50%',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >✕</button>
        </div>
        
        <div style={{ 
          padding: '20px 25px', 
          textAlign: 'center',
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 80px)'
        }}>
          <div style={{ 
            marginBottom: '20px', 
            fontStyle: 'italic', 
            fontSize: '20px',
            color: '#ffffff',
            textShadow: '0 0 8px rgba(255, 255, 255, 0.9), 0 0 12px rgba(138, 43, 226, 0.9)',
            lineHeight: '1.6'
          }}>
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_1')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_2')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_3')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_4')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_5')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_6')}
            </p>
            
            <p style={{ 
              marginBottom: '20px',
              fontWeight: '600',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              padding: '8px',
              borderRadius: '5px'
            }}>
              {t('credo_7')}
            </p>
          </div>
          
          <button 
            onClick={handleClose}
            style={{
              padding: '10px 30px',
              background: 'linear-gradient(135deg, #9932CC, #6A0DAD)',
              border: 'none',
              borderRadius: '20px',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(138, 43, 226, 0.8)',
              marginTop: '10px',
              marginBottom: '15px'
            }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
  
  // Используем портал для рендеринга модального окна на верхнем уровне DOM
  return createPortal(ModalContent, portalElement);
}; 