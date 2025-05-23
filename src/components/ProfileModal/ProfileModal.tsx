import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import styles from './ProfileModal.module.css';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: string;
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
}

interface ReferralInfo {
  referralCode: string;
  referrals: {
    userId: string;        // referalId из базы
    username: string;      // Для отображения
    photoUrl: string;      // Для отображения
    hasPlayedRoomA: boolean; // Переименовано с roomAPlayed
    hasPlayedRoomB: boolean; // Переименовано с roomBPlayed
    isValid: boolean;      // Статус валидации
    roomAPlayedAt?: Date;  // Добавляем даты
    roomBPlayedAt?: Date;  // Добавляем даты
    validatedAt?: Date;    // Добавляем дату валидации
  }[];
  totalValidReferrals: number;
  bonusesReceived: number;
  pendingBonuses: number;
  channelSubscribed: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  telegramId,
  photoUrl,
  firstName = '',
  lastName = '',
}) => {
  const t = useTranslations('Profile');
  const locale = useLocale();
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  // Запрос данных о рефералах с сервера
  const fetchReferralInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/referral/info?telegramId=${telegramId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching referral info: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }
      
      setReferralInfo(data.data);
    } catch (err: any) {
      console.error('Failed to fetch referral info:', err);
      setError(err.message || 'Failed to load referral information');
    } finally {
      setLoading(false);
    }
  }, [telegramId]);

  // Запрос информации о рефералах при открытии модального окна
  useEffect(() => {
    if (isOpen && telegramId) {
      fetchReferralInfo();
    }
  }, [isOpen, telegramId, fetchReferralInfo]);

  // Сброс состояния копирования после 2 секунд
  useEffect(() => {
    if (copiedToClipboard) {
      const timer = setTimeout(() => {
        setCopiedToClipboard(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [copiedToClipboard]);

  // Функция получения бонусного билета
  const claimBonus = async () => {
    if (!referralInfo?.pendingBonuses) return;
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/referral/claim-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telegramId }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to claim bonus');
      }
      
      // Обновляем информацию о рефералах после успешного получения бонуса
      fetchReferralInfo();
    } catch (err: any) {
      console.error('Failed to claim bonus:', err);
      setError(err.message || 'Failed to claim bonus');
    } finally {
      setLoading(false);
    }
  };

  // Функция копирования реферальной ссылки
  const copyReferralLink = () => {
    if (!referralInfo?.referralCode) return;
    
    // Используем правильный формат ссылки для прямого запуска мини-приложения
    const messageText = locale === 'en' 
      ? `☯️ Find your CHANCE in harmony with fellow Seekers!\n` +
        `🎲 Test your destiny and win on airdrop $1,000,000\n` +
        `🔮 Join TONOTCHANCE right now:\n` +
        `tg://resolve?domain=tonotchance_bot&startapp=${referralInfo.referralCode}`
      : `☯️ Обрети свой ШАНС в гармонии с остальными Искателями!\n` +
        `🎲 Испытай судьбу и выиграй на эирдропе 1.000.000$\n` +
        `🔮 Переходи в TONOTCHANCE прямо сейчас:\n` +
        `tg://resolve?domain=tonotchance_bot&startapp=${referralInfo.referralCode}`;

    console.log('[ProfileModal] Генерация реферальной ссылки:', {
      code: referralInfo.referralCode,
      message: messageText,
      language: locale
    });
    
    navigator.clipboard.writeText(messageText)
      .then(() => {
        setCopiedToClipboard(true);
        console.log('[ProfileModal] Реферальная ссылка с сообщением скопирована');
      })
      .catch(err => {
        console.error('[ProfileModal] Ошибка копирования ссылки:', err);
        setError('Failed to copy to clipboard');
      });
  };

  // Обновляем отображение ссылки в UI с учетом языка
  const getReferralLink = () => {
    if (!referralInfo?.referralCode) return '';
    const prefix = locale === 'en' ? 'TonotChance | Seekers' : 'TonotChance | Искатели';
    return `☯️ ${prefix} | tg://resolve?domain=tonotchance_bot&startapp=${referralInfo.referralCode}`;
  };

  // Функция открытия канала Telegram и обновления статуса подписки
  const openTelegramChannel = async () => {
    window.open('https://t.me/TONOTCHANCE', '_blank');
    
    // Добавляю задержку перед автоматической проверкой подписки
    setTimeout(async () => {
      try {
        setCheckingSubscription(true);
        
        // Обновляем статус подписки сразу через POST запрос
        const response = await fetch('/api/channel/check-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ telegramId }),
        });
        
        if (!response.ok) {
          throw new Error(`Error updating subscription: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Unknown error occurred');
        }
        
        // Обновляем локальное состояние, чтобы сразу показать галочку
        setReferralInfo(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            channelSubscribed: true
          };
        });
        
        // Обновляем информацию о рефералах после проверки подписки
        await fetchReferralInfo();
      } catch (err: any) {
        console.error('Failed to update channel subscription:', err);
        setError(err.message || 'Failed to update channel subscription');
      } finally {
        setCheckingSubscription(false);
      }
    }, 1000); // Задержка в 1 секунду для имитации времени подписки
  };

  // Если модальное окно закрыто, не рендерим его содержимое
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{t('profile')}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        {/* Профиль пользователя */}
        <div className={styles.userProfile}>
          <div className={styles.userAvatar}>
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={firstName}
                width={64}
                height={64}
                className={styles.avatarImage}
              />
            ) : (
              <div className={styles.defaultAvatar}>
                <span>{firstName?.charAt(0) || '?'}</span>
              </div>
            )}
          </div>
          <div className={styles.userName}>
            {firstName} {lastName}
          </div>
        </div>
        
        {loading ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
          </div>
        ) : error ? (
          <div className={styles.errorMessage}>
            {error}
            <button 
              className={styles.retryButton} 
              onClick={fetchReferralInfo}
            >
              {t('retry')}
            </button>
          </div>
        ) : referralInfo ? (
          <>
            {/* Проверка подписки на канал */}
            <div className={styles.channelSection}>
              <h3>{t('channelSubscription')}</h3>
              <div className={styles.channelContainer}>
                <div className={styles.channelStatus}>
                  <div className={`${styles.statusDot} ${referralInfo.channelSubscribed ? styles.completed : ''}`}>
                    <span>✓</span>
                  </div>
                  <span className={styles.channelName}>
                    {referralInfo.channelSubscribed ? t('subscribed') : t('notSubscribed')}
                  </span>
                </div>
                <button 
                  className={styles.channelButton}
                  onClick={referralInfo.channelSubscribed ? fetchReferralInfo : openTelegramChannel}
                  disabled={checkingSubscription}
                >
                  {checkingSubscription 
                    ? t('checking') 
                    : referralInfo.channelSubscribed 
                      ? t('checkSubscription') 
                      : t('subscribeChannel')}
                </button>
              </div>
            </div>
            
            {/* Реферальная ссылка */}
            <div className={styles.referralSection}>
              <h3>{t('yourReferralLink')}</h3>
              <div className={styles.referralLinkContainer}>
                <input 
                  type="text" 
                  readOnly 
                  value={getReferralLink()}
                  className={styles.referralLink}
                />
                <button 
                  className={styles.copyButton}
                  onClick={copyReferralLink}
                >
                  {copiedToClipboard ? t('copied') : t('copy')}
                </button>
              </div>
            </div>
            
            {/* Статистика рефералов */}
            <div className={styles.statsSection}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('totalReferrals')}</span>
                <span className={styles.statValue}>{referralInfo.referrals.length}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('validReferrals')}</span>
                <span className={styles.statValue}>{referralInfo.totalValidReferrals}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t('bonusesReceived')}</span>
                <span className={styles.statValue}>{referralInfo.bonusesReceived}</span>
              </div>
            </div>
            
            {/* Бонусные билеты */}
            {referralInfo.pendingBonuses > 0 && (
              <div className={styles.bonusSection}>
                <div className={styles.pendingBonus}>
                  <span>{t('pendingBonuses', { count: referralInfo.pendingBonuses })}</span>
                  <button 
                    className={styles.claimButton}
                    onClick={claimBonus}
                    disabled={loading}
                  >
                    {t('claimBonus')}
                  </button>
                </div>
              </div>
            )}
            
            {/* Список рефералов */}
            {referralInfo.referrals.length > 0 && (
              <div className={styles.referralsListSection}>
                <h3>{t('yourReferrals')}</h3>
                <div className={styles.referralsList}>
                  {referralInfo.referrals.map((referral) => (
                    <div 
                      key={referral.userId} 
                      className={`${styles.referralItem} ${referral.isValid ? styles.validReferral : ''}`}
                    >
                      <div className={styles.referralAvatar}>
                        {referral.photoUrl ? (
                          <Image
                            src={referral.photoUrl}
                            alt={referral.username || 'User'}
                            width={32}
                            height={32}
                          />
                        ) : (
                          <div className={styles.smallDefaultAvatar}>
                            <span>{(referral.username || '?').charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.referralName}>
                        {referral.username || t('anonymousUser')}
                      </div>
                      <div className={styles.referralStatus}>
                        <div className={styles.statusIndicators}>
                          <div 
                            className={`${styles.statusDot} ${referral.hasPlayedRoomA ? styles.completed : ''}`}
                            title={referral.roomAPlayedAt ? new Date(referral.roomAPlayedAt).toLocaleString() : t('roomANotPlayed')}
                          >
                            A
                          </div>
                          <div 
                            className={`${styles.statusDot} ${referral.hasPlayedRoomB ? styles.completed : ''}`}
                            title={referral.roomBPlayedAt ? new Date(referral.roomBPlayedAt).toLocaleString() : t('roomBNotPlayed')}
                          >
                            B
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Информация о прогрессе до следующего бонуса */}
            <div className={styles.progressSection}>
              <h3>{t('nextBonusProgress')}</h3>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${(referralInfo.totalValidReferrals % 10) * 10}%` }}
                ></div>
              </div>
              <div className={styles.progressText}>
                {t('progressText', { 
                  current: referralInfo.totalValidReferrals % 10, 
                  required: 10 
                })}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noData}>
            {t('noReferralData')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal; 