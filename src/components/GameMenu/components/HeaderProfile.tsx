import React, { useState } from 'react';
import Image from 'next/image';
import { TonConnectButton } from '@tonconnect/ui-react';
import styles from './HeaderProfile.module.css';
import ProfileModal from '../../ProfileModal/ProfileModal';

interface HeaderProfileProps {
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
  isHypnoMode?: boolean;
  isCleanMode?: boolean;
  telegramId?: string;
}

export function HeaderProfile({ 
  photoUrl, 
  firstName = '', 
  lastName = '', 
  isHypnoMode = false, 
  isCleanMode = false,
  telegramId = ''
}: HeaderProfileProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const headerClasses = [
    styles.headerProfileBlock,
    isHypnoMode ? styles.hiddenInHypnoMode : '',
    isCleanMode ? styles.hiddenInCleanMode : ''
  ].join(' ').trim();
  
  const openProfileModal = () => {
    if (telegramId) {
      setIsProfileModalOpen(true);
    }
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  return (
    <>
      <div className={headerClasses}>
        {/* Фото профиля слева */}
        <div className={`${styles.profileAvatar} ${telegramId ? styles.clickable : ''}`} onClick={openProfileModal}>
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={firstName}
              width={40}
              height={40}
            />
          ) : (
            <div className={styles.defaultAvatar}>
              <span>{firstName?.charAt(0) || '?'}</span>
            </div>
          )}
        </div>
        
        {/* Имя пользователя по центру */}
        <div className={`${styles.profileName} ${telegramId ? styles.clickable : ''}`} onClick={openProfileModal}>
          {firstName} {lastName}
        </div>
        
        {/* Кнопка кошелька справа */}
        <div className={styles.walletButtonContainer}>
          <TonConnectButton className={styles.tonConnectButton} />
        </div>
      </div>
      
      {/* Модальное окно профиля */}
      {telegramId && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={closeProfileModal}
          telegramId={telegramId}
          photoUrl={photoUrl}
          firstName={firstName}
          lastName={lastName}
        />
      )}
    </>
  );
}

export default HeaderProfile;
