'use client';

import React, { useContext } from 'react';
import { useTranslations } from 'next-intl';
import { SoundContext } from '@/components/Root/Root';
import styles from './styles/SoundButton.module.css';

const SoundButton: React.FC = () => {
  const t = useTranslations('i18n');
  const { isMuted, toggleMute } = useContext(SoundContext);

  return (
    <button 
      className={`${styles.soundButton} ${isMuted ? styles.muted : ''}`}
      onClick={toggleMute}
      title={t(isMuted ? 'unmute_sound' : 'mute_sound')}
    >
      <span className={styles.icon}>
        {isMuted ? '🔇' : '🔊'}
      </span>
    </button>
  );
};

export default SoundButton; 