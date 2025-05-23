/**
 * API функции для комнаты X10
 */

import { X10Match, X10Winner } from '@/@types/x10';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const CACHE_TIME = 60 * 1000; // 1 минута

// Кэш для ответов API
const apiCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Преобразует поля баланса из API в формат интерфейса Balance
 */
function transformBalance(apiData: any) {
  return {
    chance: Number(apiData.tickets || 0),
    tonotChance: Number(apiData.tonotChanceTickets || 0),
    tonot: Number(apiData.balance || 0),
    ton: Number(apiData.tonBalance || 0)
  };
}

/**
 * Получает URL для API эндпоинта
 */
function getApiUrl(endpoint: string): string {
  return `${API_BASE}/api/${endpoint.replace(/^api\//, '')}`;
}

/**
 * Проверяет и возвращает кэшированные данные
 */
function getCachedData<T>(key: string): T | null {
  const cached = apiCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TIME) {
    apiCache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

/**
 * Кэширует ответ API
 */
function cacheApiResponse(key: string, data: any): void {
  apiCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Создает или присоединяется к матчу X10
 * @description Только через API, без WebSocket
 */
export const createX10Match = async (telegramId: number, username: string) => {
  const response = await fetch('/api/match/x10/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      telegramId,
      username
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при создании матча');
  }

  const data = await response.json();
  
  // Преобразуем поля баланса, если они есть в ответе
  if (data.balance) {
    data.balance = transformBalance(data.balance);
  }
  
  return data;
};

/**
 * Отменяет участие в матче X10
 */
export async function cancelX10Match(telegramId: number, matchId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl('match/x10/cancel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, matchId })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Ошибка сервера' };
    }

    return data;
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}

/**
 * Завершает матч X10 и распределяет призы
 * @description Обновляет баланс через API
 */
export async function completeX10Match(matchId: string, winners: X10Winner[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(getApiUrl('match/x10/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        matchId, 
        winners,
        // Указываем правильные поля для обновления баланса
        balanceFields: {
          chance: 'tickets',
          tonotChance: 'tonotChanceTickets'
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[X10API] Complete match error:', data.error);
      return { success: false, error: data.error || 'Ошибка сервера' };
    }

    return data;
  } catch (error) {
    console.error('[X10API] Complete match error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
} 