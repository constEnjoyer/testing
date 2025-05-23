/**
 * Модуль для работы с API игровой логики
 * Содержит функции для создания/поиска матчей, обработки результатов игры и прочих игровых операций
 */

import { Match, GameResult } from '@/@types/game';

// Базовый URL для API (при необходимости можно изменить через env)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Интерфейс для данных игрока в результате матча
interface PlayerMatchResult {
  telegramId: number;
  balance: number;
  tickets: number;
  tonotChanceTickets: number;
}

// Интерфейс для данных завершенного матча
interface CompletedMatchData {
  matchId: string;
  winnerId: number;
  status: 'completed';
  winner: PlayerMatchResult;
  loser: PlayerMatchResult;
}

// Вспомогательная функция для формирования URL API
const getApiUrl = (endpoint: string): string => {
  // Убираем дублирование /api/ если оно есть в базовом URL
  if (API_BASE_URL.endsWith('/api') || API_BASE_URL.endsWith('/api/')) {
    return `${API_BASE_URL}/${endpoint.replace(/^api\//, '')}`;
  }
  return `${API_BASE_URL}/api/${endpoint}`;
};

/**
 * Создает запрос на поиск матча и ожидание оппонента
 * @param telegramId - ID пользователя Telegram
 * @param ticketsAmount - количество билетов (ставка)
 * @returns Результат создания запроса
 */
export async function findMatch(telegramId: number, ticketsAmount: number): Promise<{
  success: boolean;
  matchId?: string;
  error?: string;
}> {
  try {
    console.log('[gameApi] Создание запроса на поиск матча:', { telegramId, ticketsAmount });
    
    const apiUrl = getApiUrl('match/game');
    console.log('[gameApi] URL запроса:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramId,
        ticketsAmount,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при создании запроса на поиск матча:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] Запрос на поиск матча успешно создан:', data);
      return { success: true, matchId: data.matchId };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при создании запроса:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при создании запроса на поиск матча:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Отменяет ожидание оппонента
 * @param telegramId - ID пользователя Telegram
 * @returns Результат отмены ожидания
 */
export async function cancelWaiting(telegramId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('[gameApi] Отмена ожидания для пользователя:', telegramId);
    
    const apiUrl = getApiUrl('match/cancel');
    console.log('[gameApi] URL запроса отмены:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramId,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при отмене ожидания:', errorText);
      return { success: false, error: `Ошибка отмены: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] Ожидание успешно отменено:', data);
      return { success: true };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при отмене ожидания:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при отмене ожидания:', errorMessage);
    return { success: false, error: `Ошибка отмены: ${errorMessage}` };
  }
}

/**
 * Проверяет статус игры/матча для пользователя
 * @param telegramId - ID пользователя Telegram
 * @returns Результат проверки статуса
 */
export async function checkMatchStatus(telegramId: number): Promise<{
  success: boolean;
  isWaiting?: boolean;
  status?: string;
  match?: Match;
  error?: string;
}> {
  try {
    const apiUrl = getApiUrl(`match/game?telegramId=${telegramId}`);
    console.log('[gameApi] URL запроса статуса:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при проверке статуса матча:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] Статус матча получен:', data);
      return {
        success: true,
        isWaiting: data.isWaiting,
        status: data.status,
        match: data.match,
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при получении статуса матча:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при проверке статуса матча:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Завершает игру и отправляет результаты
 * @param matchData - данные о завершении матча
 * @returns Результат завершения игры
 */
export async function completeGame(matchData: {
  matchId: string;
  winnerId: number | null;
  player1Id: number;
  player2Id: number;
  ticketsAmount: number;
}): Promise<{
  success: boolean;
  data?: CompletedMatchData;
  error?: string;
}> {
  try {
    console.log('[gameApi] Завершение игры:', matchData);
    
    const apiUrl = getApiUrl('match/complete');
    console.log('[gameApi] URL запроса завершения:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(matchData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при завершении игры:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] Игра успешно завершена:', data);
      return { success: true, data: data.data };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при завершении игры:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при завершении игры:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Получает историю матчей пользователя
 * @param telegramId - ID пользователя Telegram
 * @param limit - максимальное количество записей (по умолчанию 10)
 * @returns Результат запроса истории
 */
export async function getMatchHistory(telegramId: number, limit: number = 10): Promise<{
  success: boolean;
  matches?: Match[];
  error?: string;
}> {
  try {
    const apiUrl = getApiUrl(`match/history?telegramId=${telegramId}&limit=${limit}`);
    console.log('[gameApi] URL запроса истории:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при получении истории матчей:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] История матчей получена:', data);
      return {
        success: true,
        matches: data.matches || [],
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при получении истории матчей:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при получении истории матчей:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}

/**
 * Очищает завершенные матчи пользователя
 * @param telegramId - ID пользователя Telegram (опционально)
 * @returns Результат очистки матчей
 */
export async function cleanupMatches(telegramId?: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    console.log('[gameApi] Запрос на очистку завершенных матчей', telegramId ? `для пользователя ${telegramId}` : 'для всех');
    
    const apiUrl = getApiUrl(`match/cleanup${telegramId ? `?telegramId=${telegramId}` : ''}`);
    console.log('[gameApi] URL запроса очистки:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gameApi] Ошибка при очистке матчей:', errorText);
      return { success: false, error: `Ошибка запроса: ${errorText}` };
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[gameApi] Матчи успешно очищены:', data);
      return {
        success: true,
        message: data.message || 'Матчи успешно очищены',
      };
    } else {
      const errorMessage = data.error || 'Неизвестная ошибка';
      console.error('[gameApi] Ошибка при очистке матчей:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[gameApi] Ошибка при очистке матчей:', errorMessage);
    return { success: false, error: `Ошибка запроса: ${errorMessage}` };
  }
}