import React from 'react';
import styles from './MenuContainer.module.css';

interface MenuContainerProps {
  children: React.ReactNode;
  isCleanMode: boolean;
}

export function MenuContainer({ children, isCleanMode }: MenuContainerProps) {
  return (
    <div className={`${styles.gameMenuPage} ${isCleanMode ? styles.cleanMode : ''} game-menu-container`}>
      {children}
    </div>
  );
}

export default MenuContainer; 