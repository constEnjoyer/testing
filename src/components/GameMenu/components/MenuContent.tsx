import React from 'react';
import styles from './MenuContent.module.css';

interface MenuContentProps {
  children: React.ReactNode;
  isCleanMode: boolean;
}

export function MenuContent({ children, isCleanMode }: MenuContentProps) {
  // Разделяем children на секции
  const childrenArray = React.Children.toArray(children);
  
  // Находим компоненты для верхней секции
  const headerProfile = childrenArray.find(child => 
    React.isValidElement(child) && 
    child.props?.['data-component'] === 'header-profile'
  );
  
  const userBalance = childrenArray.find(child =>
    React.isValidElement(child) && 
    child.props?.['data-component'] === 'user-balance'
  );
  
  // Находим компоненты для центральной секции
  const welcomeMessage = childrenArray.find(child =>
    React.isValidElement(child) && 
    child.props?.['data-component'] === 'welcome-message'
  );
  
  const hypnoWheel = childrenArray.find(child =>
    React.isValidElement(child) && 
    child.props?.className?.includes('flex justify-center')
  );
  
  // Находим компоненты для нижней секции
  const gameButton = childrenArray.find(child =>
    React.isValidElement(child) && 
    child.props?.className?.includes('mt-6 mb-8')
  );
  
  const controlButtons = childrenArray.find(child =>
    React.isValidElement(child) && 
    React.isValidElement(child.props?.children) &&
    child.props.children.type?.name === 'ControlButtons'
  );
  
  // Остальные компоненты (модальные окна)
  const modals = childrenArray.filter(child =>
    child !== headerProfile && 
    child !== userBalance && 
    child !== welcomeMessage &&
    child !== hypnoWheel &&
    child !== gameButton &&
    child !== controlButtons
  );

  return (
    <div className={`${styles.gameMenu} ${isCleanMode ? styles.cleanMode : ''}`}>
      {/* Верхняя секция */}
      <div className={styles.topSection}>
        {headerProfile && (
          <div className={styles.profileSection}>
            {headerProfile}
          </div>
        )}
        {userBalance && (
          <div className={styles.balanceSection}>
            {userBalance}
          </div>
        )}
      </div>
      
      {/* Центральная секция */}
      <div className={styles.centerSection}>
        {welcomeMessage && (
          <div className={styles.welcomeSection}>
            {welcomeMessage}
          </div>
        )}
        {hypnoWheel}
      </div>
      
      {/* Нижняя секция */}
      <div className={styles.bottomSection}>
        {gameButton}
        {controlButtons}
      </div>
      
      {/* Модальные окна */}
      {modals}
    </div>
  );
}

export default MenuContent; 