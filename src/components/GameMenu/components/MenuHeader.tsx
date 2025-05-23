'use client';

import React from 'react';
import { useContext } from 'react';
import { Avatar, Text } from '@telegram-apps/telegram-ui';
import { TonConnectButton } from '@tonconnect/ui-react';
import { SoundContext } from '@/components/Root/Root';
import { useSignal, initData } from '@telegram-apps/sdk-react';
import styles from './MenuHeader.module.css';
import UserBalance from './UserBalance';

/**
 * Компонент шапки меню с профилем пользователя и кнопкой кошелька
 */
export function MenuHeader() {
  const { playClickSound } = useContext(SoundContext);
  const initDataState = useSignal(initData.state);
  const user = initDataState?.user;
  
  if (!user) {
    return null;
  }
  
  return (
    <div className={styles.menuHeader}>
      <div className={styles.headerContent}>
        <div className={styles.userProfile} onClick={playClickSound}>
          <Avatar
            size={40}
            src={user.photoUrl}
          />
          <Text weight="semibold">{user.firstName} {user.lastName}</Text>
          <div className={styles.walletIconContainer}>
            <TonConnectButton className={styles.tonConnectButton} />
          </div>
        </div>
      </div>
      <div className={styles.balanceWrapper}>
        <UserBalance />
      </div>
    </div>
  );
}

export default MenuHeader; 