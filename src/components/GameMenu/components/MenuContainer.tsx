import React from 'react';
import styles from './styles/MenuContainer.module.css';

interface MenuContainerProps {
  children: React.ReactNode;
  isCleanMode?: boolean;
}

const MenuContainer: React.FC<MenuContainerProps> = ({ children, isCleanMode }) => {
  return (
    <div className={`${styles.container} ${isCleanMode ? styles.cleanMode : ''}`}>
      {children}
    </div>
  );
};

export default MenuContainer; 