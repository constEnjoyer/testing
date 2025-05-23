import React from 'react';
import Image from 'next/image';
import styles from './MiniHomeButton.module.css';

interface MiniHomeButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export function MiniHomeButton({ onClick, isVisible }: MiniHomeButtonProps) {
  if (!isVisible) return null;
  
  return (
    <div className={styles.miniHomeButtonContainer} onClick={onClick}>
      <div className={styles.miniHomeButton}>
        <Image 
          src="/images/main-hypno-wheel.png" 
          alt="Return to menu" 
          width={50} 
          height={50}
          className={styles.miniHomeIcon} 
        />
      </div>
    </div>
  );
}

export default MiniHomeButton; 