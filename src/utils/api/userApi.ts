/**
 * Модуль для работы с API пользователей
 * Содержит функции для аутентификации, получения и обновления данных пользователя
 */

import { UserProfile, UserBalance } from '@/contexts/UserContext';

// Базовый URL для API (при необходимости можно изменить через env)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Инициализирует пользователя Telegram
 * @param userData - данные пользователя Telegram
 * @returns Результат инициализации
 */
export async function initializeTelegramUser(userData: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  telegram_chat_id: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/telegram-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[userApi] Ошибка при инициализации пользователя Telegram:', errorText);
      return { success: false, error: `Ошибка инициализации: ${errorText}` };
    }
    
    const result = await response.json();
    return { 
      success: true, 
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        username: userData.username,
        telegramChatId: userData.telegram_chat_id
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[userApi] Ошибка при инициализации пользователя Telegram:', errorMessage);
    return { success: false, error: `Ошибка инициализации: ${errorMessage}` };
  }
}

/**
 * Получает данные пользователя (баланс, билеты и т.д.)
 * @param telegramId - ID пользователя Telegram
 * @returns Результат запроса с данными пользователя
 */
export async function getUserData(telegramId: number): Promise<{ 
  success: boolean; 
  data?: UserBalance & { success?: boolean }; 
  error?: string 
}> {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[userApi ${timestamp}] Запрос данных пользователя:`, telegramId);
    
    const response = await fetch(`${API_BASE_URL}/api/user-data?telegramId=${telegramId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[userApi ${timestamp}] Ошибка при получении данных пользователя:`, errorText);
      return { success: false, error: `Ошибка получения данных: ${errorText}` };
    }
    
    const userData = await response.json();
    console.log(`[userApi ${timestamp}] Получены данные пользователя:`, userData);
    
    // Обрабатываем разные форматы ответа
    if (userData.success === true && userData.data) {
      // Новый формат API
      return { 
        success: true, 
        data: {
          chance: userData.data.tickets || 0,
          tonotChance: userData.data.tonotChanceTickets || 0,
          tonot: userData.data.balance || 0,
          ton: userData.data.tonBalance || 0
        }
      };
    } else if (userData.tickets !== undefined) {
      // Старый формат API
      return { 
        success: true, 
        data: {
          chance: userData.tickets || 0,
          tonotChance: userData.tonotChanceTickets || 0,
          tonot: userData.balance || 0,
          ton: userData.tonBalance || 0
        }
      };
    } else {
      console.error(`[userApi ${timestamp}] Некорректный формат данных:`, userData);
      return { success: false, error: 'Некорректный формат данных пользователя' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[userApi] Ошибка при получении данных пользователя:', errorMessage);
    return { success: false, error: `Ошибка получения данных: ${errorMessage}` };
  }
}

/**
 * Сохраняет предпочитаемый язык пользователя
 * @param telegramId - ID пользователя Telegram
 * @param locale - код языка (например, 'ru', 'en')
 * @returns Результат операции
 */
export async function setUserLocale(telegramId: number, locale: string): Promise<{ 
  success: boolean; 
  error?: string 
}> {
  try {
    console.log('[userApi] Сохранение локали для пользователя:', telegramId, 'локаль:', locale);
    
    const response = await fetch(`${API_BASE_URL}/api/user-locale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramId,
        locale
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[userApi] Ошибка при сохранении локали:', errorText);
      return { success: false, error: `Ошибка сохранения локали: ${errorText}` };
    }
    
    const result = await response.json();
    console.log('[userApi] Локаль успешно сохранена:', result);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[userApi] Ошибка при сохранении локали:', errorMessage);
    return { success: false, error: `Ошибка сохранения локали: ${errorMessage}` };
  }
} 