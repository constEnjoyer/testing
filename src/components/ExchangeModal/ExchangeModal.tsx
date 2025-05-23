import { useState, useCallback, ChangeEvent, useEffect, useContext } from 'react';
import { Button, Input, Text } from '@telegram-apps/telegram-ui';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import styles from './ExchangeModal.module.css';
import modalStyles from '@/styles/common/modal.module.css';


interface ExchangeModalProps {
  open: boolean;
  onClose: () => void;
  balance: {
    tonot: number;
    ton: number;
  };
  userId: string | number;
  onSuccess?: () => void;
}

export const ExchangeModal = ({ 
  open, 
  onClose, 
  balance,
  userId,
  onSuccess
}: ExchangeModalProps) => {
  const t = useTranslations('exchange_modal');
  const messages = useTranslations('messages');
  const actions = useTranslations('actions');
  const { updateBalance, fetchUserData } = useUser();
  
  // Состояния обмена
  const [exchangeAmount, setExchangeAmount] = useState<number>(100);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0.0001);
  const [activeTab, setActiveTab] = useState<'exchange' | 'withdraw'>('exchange');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  
  // Состояние для хранения актуального баланса из API
  const [localBalance, setLocalBalance] = useState({
    tonot: balance.tonot || 0,
    ton: balance.ton || 0
  });

  // Константы обмена
  const EXCHANGE_RATE = 1000; // 1000 TONOT = 0.00000001 TON
  const MIN_EXCHANGE = 100; // Минимум 100 TONOT для обмена
  const MIN_WITHDRAW_TON = 1e-9; // Минимум для вывода TON (0.000000001 TON)
  
  // Расчет получаемого TON при обмене
  const calculatedTon = exchangeAmount / EXCHANGE_RATE * 0.00000001;
  
  // Функция для корректного форматирования чисел TON
  const formatTonAmount = (amount: number): string => {
    // Проверяем, что число корректное
    if (isNaN(amount) || amount === 0) {
      return "0";
    }
    
    // Безопасное форматирование для всех чисел - фиксированное количество знаков
    try {
      return amount.toFixed(8);
    } catch (e) {
      console.error("Ошибка форматирования числа:", e);
      return "0";
    }
  };

  // Создаем "защищенный" парсер для маленьких чисел
  const parseTonAmount = (amountStr: string): number => {
    try {
      // Сначала пробуем обычный parseFloat
      const amount = parseFloat(amountStr);
      
      // Если это NaN или 0, возвращаем 0
      if (isNaN(amount) || amount === 0) {
        return 0;
      }
      
      return amount;
    } catch (e) {
      console.error("Ошибка парсинга числа:", e);
      return 0;
    }
  };
  
  // Обработчик изменения суммы обмена
  const handleExchangeAmountChange = (value: string) => {
    const amount = parseInt(value, 10);
    if (!isNaN(amount) && amount >= 0) {
      setExchangeAmount(amount);
    }
  };
  
  // Обработчик установки максимальной суммы TONOT для обмена
  const handleMaxExchangeAmount = () => {
    // Используем доступный баланс TONOT, но не меньше минимальной суммы для обмена
    const maxAmount = Math.max(localBalance.tonot, MIN_EXCHANGE);
    setExchangeAmount(maxAmount);
  };
  
  // Обработчик изменения суммы вывода
  const handleWithdrawAmountChange = (value: string) => {
    // Заменяем запятые на точки для международного формата
    const sanitizedValue = value.replace(',', '.');
    
    try {
      // Проверяем, что введенное значение - допустимое число
      if (sanitizedValue === '' || sanitizedValue === '.') {
        setWithdrawAmount(0);
        return;
      }
      
      // Парсим введенное значение
      const amount = parseFloat(sanitizedValue);
      
      // Проверяем, что это число и оно не отрицательное
      if (!isNaN(amount) && amount >= 0) {
        // Проверяем, что сумма не превышает баланс
        if (amount <= localBalance.ton) {
          setWithdrawAmount(amount);
          setError(null);
        } else {
          // Если превышает баланс, устанавливаем максимальное доступное значение
          setWithdrawAmount(localBalance.ton);
          setError(messages('amount_exceeds_balance'));
        }
      }
    } catch (e) {
      console.error("Ошибка при обработке введённого значения:", e);
    }
  };
  
  // Обработчик установки максимальной суммы TON для вывода
  const handleMaxWithdrawAmount = () => {
    // Проверка на минимальное значение для вывода
    if (localBalance.ton < MIN_WITHDRAW_TON) {
      setError(messages('insufficient_balance'));
      return;
    }
    
    // Устанавливаем точное число из баланса без форматирования
    setWithdrawAmount(localBalance.ton);
    // Очищаем сообщение об ошибке, если оно было
    setError(null);
  };
  
  // Обработчик изменения адреса кошелька
  const handleWalletAddressChange = (value: string) => {
    setWalletAddress(value.trim());
  };
  
  // В начале компонента добавим состояние для отслеживания инициализации
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  
  // Прямой запрос к API для получения актуального баланса
  const fetchDirectBalance = useCallback(async () => {
    if (!userId) {
      console.log('[ExchangeModal] Нет ID пользователя для запроса баланса');
      return;
    }
    
    setIsInitializing(true);
    
    try {
      console.log('[ExchangeModal] Прямой запрос баланса из API:', userId);
      
      // Добавляем случайный параметр для избегания кэширования
      const cacheKey = Date.now();
      const response = await fetch(`/api/user-data?telegramId=${userId}&_cache=${cacheKey}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ExchangeModal] Ошибка при получении данных:', errorText);
        return;
      }
      
      const data = await response.json();
      console.log('[ExchangeModal] Получены данные из API:', data);
      
      // Обработка успешного ответа
      if (data.success && data.data) {
        // Обновляем локальное состояние баланса
        const newBalance = {
          tonot: Number(data.data.balance) || 0,
          ton: Number(data.data.tonBalance) || 0
        };
        
        console.log('[ExchangeModal] Обновляем локальный баланс:', newBalance);
        setLocalBalance(newBalance);
        
        // Также обновляем глобальный баланс в контексте пользователя
        updateBalance({
          chance: Math.round(Number(data.data.tickets) || 0),
          tonotChance: Math.round(Number(data.data.tonotChanceTickets) || 0),
          tonot: Number(data.data.balance) || 0,
          ton: Number(data.data.tonBalance) || 0
        });
      }
    } catch (error) {
      console.error('[ExchangeModal] Ошибка при запросе баланса:', error);
    } finally {
      setIsInitializing(false);
      setIsLoading(false);
    }
  }, [userId, updateBalance]);
  
  // Инициализация при открытии модального окна
  useEffect(() => {
    if (open) {
      // Сразу загружаем баланс при открытии окна
      fetchDirectBalance();
      
      // Сбрасываем состояния
      setError(null);
      setSuccess(null);
      setExchangeAmount(100);
      setWithdrawAmount(0.0001);
      
      console.log('[ExchangeModal] Модальное окно открыто, запрашиваем актуальный баланс');
      
      // Блокируем прокрутку страницы
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      // Разблокируем прокрутку при закрытии
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    
    // Очистка при размонтировании
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [open, fetchDirectBalance]);
  
  // Функция для обмена TONOT на TON
  const handleExchange = useCallback(async () => {
    if (exchangeAmount < MIN_EXCHANGE) {
      setError(`Минимальная сумма для обмена: ${MIN_EXCHANGE} TONOT`);
      return;
    }
    
    if (exchangeAmount > localBalance.tonot) {
      setError(messages('insufficient_balance'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log('[ExchangeModal] Начало обмена TONOT на TON:', exchangeAmount);
      
      const response = await fetch('/api/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: userId,
          amount: exchangeAmount
        }),
      });
      
      const data = await response.json();
      console.log('[ExchangeModal] Ответ от сервера:', data);
      
      if (data.success) {
        setSuccess(messages('exchange_tonot_success', { 
          tonot: exchangeAmount,
          ton: calculatedTon.toFixed(8)
        }));
        
        // Запрашиваем актуальный баланс после успешного обмена
        await fetchDirectBalance();
        
        // Также обновляем через контекст для надежности
        await fetchUserData();
      } else {
        setError(data.error || 'Произошла ошибка при обмене');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('[ExchangeModal] Ошибка при обмене:', err);
    } finally {
      setIsLoading(false);
    }
  }, [exchangeAmount, localBalance.tonot, userId, calculatedTon, messages, fetchDirectBalance, fetchUserData]);
  
  // Функция для запроса вывода TON
  const handleWithdraw = useCallback(async () => {
    if (!walletAddress || walletAddress.length < 10) {
      setError(messages('invalid_wallet_address'));
      return;
    }
    
    if (withdrawAmount <= 0) {
      setError('Сумма вывода должна быть больше 0');
      return;
    }
    
    if (withdrawAmount < MIN_WITHDRAW_TON) {
      setError(`Минимальная сумма для вывода: ${formatExactTonAmount(MIN_WITHDRAW_TON)} TON`);
      return;
    }
    
    if (withdrawAmount > localBalance.ton * 1.001) {
      setError(messages('insufficient_ton_balance'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('[ExchangeModal] Начало вывода TON:', withdrawAmount, 'на адрес:', walletAddress);
      
      const formattedAmount = withdrawAmount.toString();

      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: userId,
          amount: formattedAmount,
          walletAddress
        }),
      });
      
      const data = await response.json();
      console.log('[ExchangeModal] Ответ от сервера (вывод):', data);
      
      if (data.success) {
        setSuccess(messages('withdraw_success', { amount: formattedAmount }));
        
        // Запрашиваем актуальный баланс после успешного вывода
        await fetchDirectBalance();
        
        // Также обновляем через контекст для надежности
        await fetchUserData();
      } else {
        setError(data.error || 'Произошла ошибка при создании запроса на вывод');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('[ExchangeModal] Ошибка при выводе:', err);
    } finally {
      setIsLoading(false);
    }
  }, [withdrawAmount, walletAddress, localBalance.ton, userId, messages, fetchDirectBalance, fetchUserData]);
  
  // Функция для отображения точного TON баланса с сохранением всех значащих цифр
  const formatExactTonAmount = (amount: number): string => {
    try {
      // Если значение очень близко к нулю, сразу возвращаем "0"
      if (Math.abs(amount) < 1e-12) {
        return "0";
      }

      // Наиболее безопасный способ - использовать строковое представление числа
      const str = amount.toString();

      // Если это число в научной нотации (например, 2.56e-7)
      if (str.includes('e')) {
        // Разбиваем число на две части: базу и экспоненту
        const [base, expPart] = str.split('e');

        // Определяем знак экспоненты
        const isNegative = expPart.startsWith('-');
        // Получаем абсолютное значение экспоненты
        const exp = parseInt(expPart.replace('-', '').replace('+', ''), 10);

        // Если это очень маленькое число (e-...)
        if (isNegative) {
          // Разбиваем базу на целую и дробную части
          const [intPart, fracPart = ''] = base.split('.');
          // Объединяем все цифры
          const digits = intPart + fracPart;

          // Вычисляем, сколько нулей нужно добавить после десятичной точки
          const zerosNeeded = exp - fracPart.length;

          // Если нужно добавить нули, формируем строку вида 0.000...XXX
          if (zerosNeeded > 0) {
            return `0.${'0'.repeat(zerosNeeded)}${digits}`;
          } else {
            // Если нулей не нужно (или нужно меньше), формируем строку по-другому
            const result = `0.${digits.padStart(exp, '0')}`;
            return result;
          }
        } else {
          // Для чисел с положительной экспонентой (e+...)
          return amount.toFixed(10).replace(/\.?0+$/, '');
        }
      }

      // Для обычных чисел просто удаляем лишние нули после запятой
      const fixed = parseFloat(amount.toFixed(10));
      return fixed.toString();
    } catch (e) {
      console.error("Ошибка в formatExactTonAmount:", e);
      // Если что-то пошло не так, возвращаем строковое представление
      return String(amount);
    }
  };
  
  if (!open) return null;
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3>{t('title')}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalTabs}>
          <div 
            className={`${styles.modalTab} ${activeTab === 'exchange' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('exchange');
              setSuccess(null);
              setError(null);
            }}
          >
            {t('exchange_tab')}
          </div>
          <div 
            className={`${styles.modalTab} ${activeTab === 'withdraw' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('withdraw');
              setSuccess(null);
              setError(null);
            }}
          >
            {t('withdraw_tab')}
          </div>
        </div>
        
        <div className={styles.modalContent}>
          {isInitializing ? (
            <div className={styles.loadingIndicator}>
              <div className={styles.loadingSpinner}></div>
              <div className={styles.mt4}>Загрузка данных...</div>
            </div>
          ) : (
            <>
              {activeTab === 'exchange' ? (
                <div className={styles.exchangeForm}>
                  <div className={`${styles.cosmicTextContainer} ${styles.mb4}`}>
                    <div className={styles.goldenText}>
                      {t('tonot_balance', { amount: localBalance.tonot.toFixed(2) })}
                    </div>
                    <div className={styles.cosmicText}>
                      {t('exchange_rate')}
                    </div>
                  </div>

                  <div className={`${styles.instructionText} ${styles.mb3}`}>
                    {messages('enter_exchange_amount')}
                  </div>

                  <div className={styles.inputContainer}>
                    <input
                      type="number"
                      min={MIN_EXCHANGE}
                      max={localBalance.tonot}
                      value={exchangeAmount}
                      onChange={(e) => handleExchangeAmountChange(e.target.value)}
                      disabled={isLoading}
                      className={styles.inputField}
                    />
                    <button 
                      className={styles.maxButton} 
                      onClick={handleMaxExchangeAmount} 
                      type="button"
                      disabled={isLoading || localBalance.tonot < MIN_EXCHANGE}
                    >
                      МАКС
                    </button>
                  </div>

                  <div className={styles.calculationResult}>
                    {t('will_receive', { amount: calculatedTon.toFixed(8) })}
                  </div>

                  {error && <div className={styles.errorMessage}>{error}</div>}
                  {success && <div className={styles.successMessage}>{success}</div>}

                  <div className={`${styles.buttonContainer} ${styles.mt4}`}>
                    <button 
                      className={styles.actionButton}
                      onClick={handleExchange}
                      disabled={
                        isLoading || 
                        exchangeAmount < MIN_EXCHANGE || 
                        exchangeAmount > localBalance.tonot
                      }
                    >
                      {isLoading ? t('processing') : t('exchange_button')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.withdrawForm}>
                  <div className={styles.balanceInfo}>
                    <p>{t('ton_balance', { amount: formatTonAmount(localBalance.ton) })}</p>
                  </div>
                  
                  <div className={styles.inputWrapper}>
                    <label>{t('withdraw_amount')}</label>
                    <div className={styles.inputContainer}>
                      <input
                        type="text"
                        value={formatTonAmount(withdrawAmount)}
                        onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                        className={styles.inputField}
                        placeholder={messages('enter_withdraw_amount')}
                      />
                      <button 
                        className={styles.maxButton} 
                        onClick={handleMaxWithdrawAmount}
                        title="Использовать максимальную сумму"
                      >
                        МАКС
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.inputWrapper}>
                    <label>{t('wallet_address')}</label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => handleWalletAddressChange(e.target.value)}
                      placeholder="UQ..."
                      className={styles.walletAddressField}
                    />
                  </div>
                  
                  {error && <div className={styles.errorMessage}>{error}</div>}
                  {success && <div className={styles.successMessage}>{success}</div>}
                  
                  <button 
                    className={styles.actionButton}
                    onClick={handleWithdraw}
                    disabled={isLoading || withdrawAmount <= 0 || !walletAddress || walletAddress.length < 10}
                  >
                    {isLoading ? t('processing') : t('withdraw_button')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 
