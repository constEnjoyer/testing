'use client';

import { useState, useContext, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Text } from '@telegram-apps/telegram-ui';
import Image from 'next/image';
import { SoundContext } from '@/components/Root/Root';
import { buyTicketsWithTon } from '@/utils/api/tonApi';
import { CONFIG } from '@/lib/config';
import styles from './TicketPurchaseModal.module.css';
import { useUser } from '@/contexts/UserContext';

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId?: number;
  walletAddress?: string;
  onPurchaseSuccess?: (responseData: any) => void;
  connected: boolean;
  sendTransaction?: (amount: number, toAddress: string) => Promise<{ boc: string }>;
  isGameRoom?: boolean;
}

/**
 * Компонент модального окна покупки билетов
 */
export const TicketPurchaseModal: React.FC<TicketPurchaseModalProps> = ({
  isOpen,
  onClose,
  telegramId,
  walletAddress,
  onPurchaseSuccess,
  connected,
  sendTransaction,
  isGameRoom = false
}) => {
  const { playClickSound } = useContext(SoundContext);
  const t = useTranslations('i18n');
  const { fetchUserData, updateBalance } = useUser();

  // Состояния компонента
  const [ticketAmount, setTicketAmount] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Обработчик изменения количества билетов
  const handleTicketAmountChange = (value: string) => {
    const numValue = parseInt(value, 10);
    
    if (isNaN(numValue)) {
      setTicketAmount(1); // Значение по умолчанию при ошибке
    } else {
      const clampedValue = Math.max(1, numValue); // Убрано ограничение максимального количества
      setTicketAmount(clampedValue);
    }
  };

  // Сбрасываем состояния при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      console.log('[TicketPurchaseModal] Модальное окно открыто');
      setTicketAmount(1);
      setPurchaseError(null);
      setPurchaseSuccess(false);
      setPurchaseLoading(false);
      
      // Блокируем прокрутку страницы
      document.body.style.overflow = 'hidden';
    } else {
      console.log('[TicketPurchaseModal] Модальное окно закрыто');
      // Разрешаем прокрутку страницы
      document.body.style.overflow = 'auto';
    }
    
    // Очистка при размонтировании
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  /**
   * Функция для прямого обновления баланса из API
   */
  const fetchDirectBalance = useCallback(async () => {
    if (!telegramId) {
      console.log('[TicketPurchaseModal] Нет ID пользователя для запроса баланса');
      return;
    }
    
    try {
      console.log('[TicketPurchaseModal] Прямой запрос баланса после покупки:', telegramId);
      
      // Добавляем случайный параметр для избегания кэширования
      const cacheKey = Date.now();
      const response = await fetch(`/api/user-data?telegramId=${telegramId}&_cache=${cacheKey}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TicketPurchaseModal] Ошибка при получении данных после покупки:', errorText);
        return;
      }
      
      const data = await response.json();
      console.log('[TicketPurchaseModal] Получены обновленные данные (сырые):', JSON.stringify(data));
      
      // Детальное логирование типов и значений для отладки
      if (data.success && data.data) {
        console.log('[TicketPurchaseModal] Тип tickets:', typeof data.data.tickets);
        console.log('[TicketPurchaseModal] Значение tickets до преобразования:', data.data.tickets);
        
        // Явное округление до целых чисел для билетов
        const tickets = Math.round(Number(data.data.tickets) || 0);
        const tonotChanceTickets = Math.round(Number(data.data.tonotChanceTickets) || 0);
        
        console.log('[TicketPurchaseModal] Значение tickets после округления:', tickets);
        
        const newBalance = {
          chance: tickets,
          tonotChance: tonotChanceTickets,
          tonot: Number(data.data.balance) || 0,
          ton: Number(data.data.tonBalance) || 0
        };
        
        console.log('[TicketPurchaseModal] Обновление баланса после покупки:', newBalance);
        // Обновляем баланс в контексте
        updateBalance(newBalance);
      } else {
        console.error('[TicketPurchaseModal] Данные не получены или неверный формат:', data);
      }
    } catch (error) {
      console.error('[TicketPurchaseModal] Ошибка при обновлении баланса после покупки:', error);
    }
  }, [telegramId, updateBalance]);

  /**
   * Обработчик покупки билетов
   */
  const purchaseTickets = useCallback(async () => {
    if (!ticketAmount || ticketAmount <= 0) {
      if (isGameRoom) {
        playClickSound();
      }
      onClose();
      return;
    }

    try {
      setPurchaseLoading(true);
      setPurchaseError(null);
      setPurchaseSuccess(false);

      console.log('[TicketPurchaseModal] Начало покупки билетов...');
      console.log(`[TicketPurchaseModal] Количество билетов: ${ticketAmount}`);
      console.log(`[TicketPurchaseModal] Сумма к оплате: ${ticketAmount * CONFIG.TICKET_PRICE} TON`);

      // Проверяем, что пользователь подключен к кошельку
      if (!connected) {
        console.error('[TicketPurchaseModal] Кошелек не подключен');
        setPurchaseError(t('purchase_error_wallet'));
        setPurchaseLoading(false);
        return;
      }

      // Проверяем, что у нас есть telegramId пользователя
      if (!telegramId) {
        console.error('[TicketPurchaseModal] TelegramId не определен');
        setPurchaseError(t('purchase_error_telegram'));
        setPurchaseLoading(false);
        return;
      }

      // Проверяем наличие адреса кошелька
      if (!walletAddress) {
        console.error('[TicketPurchaseModal] Адрес кошелька не определен');
        setPurchaseError(t('purchase_error_address'));
        setPurchaseLoading(false);
        return;
      }

      // Рассчитываем общую сумму для покупки билетов
      const amount = ticketAmount * CONFIG.TICKET_PRICE;
      
      // Используем API-модуль для покупки билетов
      const result = await buyTicketsWithTon(telegramId, amount, walletAddress, sendTransaction);
      
      if (!result.success) {
        throw new Error(result.error || t('purchase_error_general'));
      }

      // Показываем сообщение об успехе
      console.log('[TicketPurchaseModal] Покупка успешно завершена:', result);
      setPurchaseSuccess(true);
      
      // Обновляем данные пользователя (включая баланс) через контекст
      await fetchUserData();
      
      // Также запрашиваем прямое обновление баланса из API для гарантии актуальных данных
      await fetchDirectBalance();
      
      // Уведомляем родительский компонент об успешной покупке
      if (onPurchaseSuccess && result.success) {
        onPurchaseSuccess(result);
      }
      
      // Сбрасываем количество билетов на значение по умолчанию
      setTicketAmount(1);
      
      // Больше НЕ закрываем окно автоматически
      // Пользователь должен сам закрыть окно после успешной покупки
    } catch (error) {
      console.error('[TicketPurchaseModal] Ошибка при покупке билетов:', error);
      setPurchaseError(error instanceof Error ? error.message : t('purchase_error_unknown'));
    } finally {
      setPurchaseLoading(false);
    }
  }, [ticketAmount, connected, telegramId, walletAddress, sendTransaction, onPurchaseSuccess, fetchUserData, fetchDirectBalance, isGameRoom, onClose, playClickSound, t]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Не рендерим ничего, если модальное окно закрыто
  if (!isOpen) return null;

  return (
    <div className={styles.ticketModal}>
      <div className={styles.ticketModalInner}>
        <div className={styles.ticketModalHeader}>
          <h3>{t('buy_chance_tickets')}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.ticketModalContent}>
          <div className={styles.ticketImage}>
            <Image
              src="/images/tickets.png"
              alt="Chance Tickets"
              width={80}
              height={80}
              priority
            />
          </div>
          <div className={styles.ticketDescription}>
            <Text weight="regular">{t('ticket_description')}</Text>
          </div>
          <div className={styles.ticketAmountControl}>
            <button
              className={styles.amountBtn}
              onClick={() => {
                playClickSound();
                handleTicketAmountChange(Math.max(1, ticketAmount - 1).toString());
              }}
            >
              -
            </button>
            <input
              type="number"
              value={ticketAmount.toString()}
              onChange={(e) => handleTicketAmountChange(e.target.value)}
              min="1"
              className={styles.ticketAmountInput}
            />
            <button
              className={styles.amountBtn}
              onClick={() => {
                playClickSound();
                handleTicketAmountChange((ticketAmount + 1).toString());
              }}
            >
              +
            </button>
          </div>
          <div className={styles.ticketTotal}>
            <Text weight="bold">
              {t('total_price')}: {(ticketAmount * CONFIG.TICKET_PRICE).toFixed(8)} TON
            </Text>
          </div>
          <Button
            className={styles.purchaseButton}
            onClick={() => {
              playClickSound();
              purchaseTickets();
            }}
            disabled={purchaseLoading}
            size="l"
          >
            {purchaseLoading ? (
              <>
                <span className={styles.loadingDot}>•</span>
                <span className={styles.loadingDot}>•</span>
                <span className={styles.loadingDot}>•</span>
              </>
            ) : (
              t('purchase')
            )}
          </Button>
          {purchaseError && <div className={styles.errorMessage}>{purchaseError}</div>}
          {purchaseSuccess && <div className={styles.successMessage}>{t('purchase_success')}</div>}
        </div>
      </div>
    </div>
  );
}; 