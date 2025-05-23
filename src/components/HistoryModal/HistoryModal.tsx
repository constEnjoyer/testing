import { useState, useEffect } from 'react';
import { Button, Text } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import styles from './HistoryModal.module.css';
import modalStyles from '@/styles/common/modal.module.css';

// Интерфейс для историй действий
interface HistoryItem {
  id: string;
  type: 'game' | 'exchange' | 'purchase' | 'ticket_purchase' | 'withdraw';
  date: string;
  details: {
    opponent?: string;
    result?: 'win' | 'lose';
    amount?: number;
    tonot?: number;
    ton?: number;
    tickets?: number;
    walletAddress?: string;
    status?: string;
    tonotReward?: number;
    transactionHash?: string;
  };
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  userId: number | string;
}

export const HistoryModal = ({ open, onClose, userId }: HistoryModalProps) => {
  const t = useTranslations('history');
  const i18n = useTranslations('i18n');
  
  // Состояния
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Загрузка истории
  useEffect(() => {
    const fetchHistory = async () => {
      if (!open) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Запрос на API
        const response = await fetch(`/api/user-history?userId=${userId}&page=${page}`);
        
        console.log('История запрос:', `userId=${userId}&page=${page}`);
        
        const data = await response.json();
        console.log('История ответ:', data);

        if (data.success) {
          if (page === 1) {
            setHistory(data.data.items || []);
          } else {
            setHistory(prev => [...prev, ...(data.data.items || [])]);
          }
          setHasMore(data.data.hasMore || false);
        } else {
          throw new Error(data.error || 'Ошибка при получении истории');
        }
      } catch (err: any) {
        console.error('Ошибка загрузки истории:', err);
        setError(err.message || 'Ошибка при загрузке истории');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, [open, userId, page]);
  
  // Загрузка дополнительных страниц
  const loadMore = () => {
    setPage(prev => prev + 1);
  };
  
  // Локализация типов истории
  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'game':
        return t('type_game');
      case 'exchange':
        return t('type_exchange');
      case 'purchase':
      case 'ticket_purchase':
        return t('type_purchase');
      case 'withdraw':
        return t('type_withdraw');
      default:
        return type;
    }
  };
  
  // Форматирование даты
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  // Форматирование чисел без научной нотации
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return '0';
    
    // Для чисел с большим количеством нулей, предотвращаем научную нотацию (1e+7)
    if (Math.abs(num) >= 1e7 || (Math.abs(num) < 1e-7 && num !== 0)) {
      return num.toLocaleString('fullwide', { useGrouping: true });
    }
    
    return num.toString();
  };
  
  // Форматирование детали истории
  const formatDetails = (item: HistoryItem) => {
    switch(item.type) {
      case 'game':
        return item.details.result === 'win'
          ? t.rich('win_result', { 
              amount: formatNumber(item.details.tonotReward || item.details.amount || 0) 
            })
          : t('lose_result');
      case 'exchange':
        return t.rich('exchange_result', { 
          tonot: formatNumber(item.details.tonot || 0), 
          ton: formatNumber(item.details.ton || 0) 
        });
      case 'purchase':
      case 'ticket_purchase':
        return t.rich('purchase_result', { 
          amount: formatNumber(item.details.tickets || 0) 
        });
      case 'withdraw':
        return t.rich('withdraw_result', {
          amount: formatNumber(item.details.amount || 0),
          status: item.details.status || 'в обработке'
        });
      default:
        return '';
    }
  };
  
  // Добавляем эффект для блокировки прокрутки страницы
  useEffect(() => {
    if (open) {
      // Блокируем прокрутку
      document.body.style.overflow = 'hidden';
    } else {
      // Разрешаем прокрутку
      document.body.style.overflow = 'auto';
    }
    
    // Очистка при размонтировании компонента
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [open]);
  
  if (!open) return null;
  
  return (
    <div className={styles.historyModalOverlay}>
      <div className={styles.historyModal}>
        <div className={styles.modalHeader}>
          <h3>{i18n('history')}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.historyContent}>
          {isLoading && page === 1 ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <Text>{t('loading')}</Text>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <div className={styles.errorText}>{error}</div>
            </div>
          ) : history.length === 0 ? (
            <div className={styles.emptyHistory}>
              <Text>{t('no_history')}</Text>
            </div>
          ) : (
            <>
              <div className={styles.historyList}>
                {history.map((item) => (
                  <div key={item.id} className={`${styles.historyItem} ${styles[`type${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`]}`}>
                    <div className={styles.transactionInfo}>
                      <span className={styles.historyType}>{getTypeLabel(item.type)}</span>
                      <span className={styles.historyDate}>{formatDate(item.date)}</span>
                    </div>
                    <div className={styles.transactionDetails}>
                      {formatDetails(item)}
                    </div>
                  </div>
                ))}
              </div>
              
              {isLoading && page > 1 && (
                <div className={styles.loadingMore}>
                  <div className={styles.spinner}></div>
                  <Text>{t('loading_more')}</Text>
                </div>
              )}
              
              {hasMore && !isLoading && (
                <Button 
                  className={styles.loadMoreButton}
                  onClick={loadMore}
                >
                  {t('load_more')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 