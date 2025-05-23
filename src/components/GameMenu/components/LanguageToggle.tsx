'use client';

import { useContext } from 'react';
import { useLocale } from 'next-intl';
import { SoundContext } from '@/components/Root/Root';
import { setLocale } from '@/core/i18n/locale';
import styles from './LanguageToggle.module.css';

interface LanguageToggleProps {
  currentLocale?: string;
  onLocaleChange?: (newLocale: string) => void;
}

/**
 * Компонент для переключения языка приложения
 */
export const LanguageToggle: React.FC<LanguageToggleProps> = ({ 
  currentLocale: propLocale,
  onLocaleChange 
}) => {
  const { playClickSound } = useContext(SoundContext);
  const contextLocale = useLocale();
  
  // Используем локаль из пропсов, если она передана, иначе используем локаль из контекста
  const currentLocale = propLocale || contextLocale;
  
  const toggleLanguage = () => {
    playClickSound();
    const newLocale = currentLocale === 'ru' ? 'en' : 'ru';
    console.log('[LanguageToggle] Переключение языка на:', newLocale);
    
    // Если передан обработчик изменения локали, вызываем его
    if (onLocaleChange) {
      onLocaleChange(newLocale);
    } else {
      // Иначе используем стандартный механизм изменения локали
      setLocale(newLocale);
    }
  };
  
  return (
    <button 
      className={styles.languageToggle}
      onClick={toggleLanguage}
      aria-label="Изменить язык"
    >
      {currentLocale === 'ru' ? 'RU' : 'EN'}
    </button>
  );
};

export default LanguageToggle; 