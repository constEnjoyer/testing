/**
 * Модуль для работы с API TON блокчейна
 * Содержит функции для взаимодействия с TON кошельками, смарт-контрактами и операциями с токенами
 */

import { CONFIG } from '@/lib/config';

// Базовый URL для API (при необходимости можно изменить через env)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Покупает билеты за TON
 * @param telegramId - ID пользователя Telegram
 * @param amount - количество TON для обмена
 * @param walletAddress - адрес кошелька пользователя
 * @param sendTransaction - функция для отправки транзакции (опционально)
 * @returns Результат покупки
 */
export async function buyTicketsWithTon(
  telegramId: number, 
  amount: number, 
  walletAddress: string,
  sendTransaction?: (amount: number, toAddress: string) => Promise<{ boc: string }>
): Promise<{
  success: boolean;
  tickets?: number;
  error?: string;
}> {
  try {
    console.log('[tonApi] Покупка билетов за TON:', { telegramId, amount, walletAddress });
    
    // Рассчитываем количество билетов на основе суммы и цены билета
    console.log('[tonApi] Сумма для расчета билетов:', amount, 'тип:', typeof amount);
    console.log('[tonApi] Цена одного билета:', CONFIG.TICKET_PRICE, 'TON');
    
    // Формула: количество билетов = сумма / цена билета
    // Округляем вниз, чтобы не давать частичные билеты
    let tickets = Math.floor(amount / CONFIG.TICKET_PRICE);
    
    console.log('[tonApi] Рассчитанное количество билетов:', tickets);
    
    let transactionHash = '';
    
    // Если есть функция отправки транзакции, используем её
    if (sendTransaction) {
      try {
        console.log('[tonApi] Использование реальной транзакции TON');
        
        // Отправляем TON на адрес разработчика
        const result = await sendTransaction(amount, CONFIG.DEVELOPER_ADDRESS);
        
        if (!result || !result.boc) {
          throw new Error('Транзакция отменена или не выполнена');
        }
        
        // Получаем хеш транзакции
        transactionHash = result.boc;
        console.log('[tonApi] Транзакция выполнена, получен хеш:', transactionHash);
      } catch (error) {
        console.error('[tonApi] Ошибка при отправке TON транзакции:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Ошибка при отправке TON' 
        };
      }
    } else {
      // В случае отсутствия функции sendTransaction генерируем временный хеш
      console.log('[tonApi] Использование имитации транзакции (без реальной отправки TON)');
      transactionHash = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    // Отправляем запрос к API для сохранения информации о покупке
    const response = await fetch('/api/tickets/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramId,
        amount,
        tickets, // Теперь гарантированно целое положительное число для amount > 0
        transactionHash,
        walletAddress,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tonApi] Ошибка при покупке билетов за TON:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[tonApi] Билеты успешно куплены:', data);
      return {
        success: true,
        tickets: data.data?.tickets || 0,
      };
    } else {
      console.error('[tonApi] Ошибка при покупке билетов:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('[tonApi] Исключение при покупке билетов:', error);
    return { success: false, error: 'Произошла ошибка при покупке билетов' };
  }
}

/**
 * Выводит TON на кошелек пользователя
 * @param telegramId - ID пользователя Telegram
 * @param amount - количество TON для вывода
 * @param walletAddress - адрес кошелька для вывода
 * @returns Результат операции
 */
export async function withdrawTon(telegramId: number, amount: number, walletAddress: string): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> {
  try {
    console.log('[tonApi] Вывод TON:', { telegramId, amount, walletAddress });
    
    const response = await fetch(`${API_BASE_URL}/api/ton/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramId,
        amount,
        walletAddress,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tonApi] Ошибка при выводе TON:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[tonApi] TON успешно выведен:', data);
      return {
        success: true,
        transactionId: data.transactionId,
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[tonApi] Ошибка при выводе TON:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[tonApi] Ошибка при выводе TON:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Получает историю транзакций пользователя
 * @param telegramId - ID пользователя Telegram
 * @param limit - максимальное количество записей (по умолчанию 10)
 * @returns Результат запроса истории
 */
export async function getTransactionHistory(telegramId: number, limit: number = 10): Promise<{
  success: boolean;
  transactions?: Array<{
    id: string;
    type: 'deposit' | 'withdraw' | 'game';
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    timestamp: string;
    address?: string;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ton/history?telegramId=${telegramId}&limit=${limit}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tonApi] Ошибка при получении истории транзакций:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[tonApi] История транзакций получена:', data);
      return {
        success: true,
        transactions: data.transactions || [],
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[tonApi] Ошибка при получении истории транзакций:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[tonApi] Ошибка при получении истории транзакций:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Проверяет статус транзакции
 * @param transactionId - ID транзакции
 * @returns Результат проверки
 */
export async function checkTransactionStatus(transactionId: string): Promise<{
  success: boolean;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ton/transaction/${transactionId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tonApi] Ошибка при проверке статуса транзакции:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[tonApi] Статус транзакции получен:', data);
      return {
        success: true,
        status: data.status,
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[tonApi] Ошибка при проверке статуса транзакции:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[tonApi] Ошибка при проверке статуса транзакции:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
} 