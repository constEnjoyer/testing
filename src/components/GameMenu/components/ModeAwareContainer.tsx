import React from 'react';
import styles from './ModeAwareContainer.module.css';

interface ModeAwareContainerProps {
  children: React.ReactNode;
  isHypnoMode?: boolean;
  isCleanMode?: boolean;
  hideInHypnoMode?: boolean;
  hideInCleanMode?: boolean;
}

/**
 * Компонент-обертка для элементов, которые должны скрываться в разных режимах
 */
export function ModeAwareContainer({
  children,
  isHypnoMode = false,
  isCleanMode = false,
  hideInHypnoMode = true,
  hideInCleanMode = true
}: ModeAwareContainerProps) {
  // Определяем видимость на основе флагов режимов и настроек видимости
  const shouldHide = 
    (isHypnoMode && hideInHypnoMode) || 
    (isCleanMode && hideInCleanMode);
  
  if (shouldHide) {
    return null;
  }
  
  return (
    <div className={styles.container}>
      {children}
    </div>
  );
}

export default ModeAwareContainer; 