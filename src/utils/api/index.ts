/**
 * Экспорт всех API модулей для удобного импорта
 */

export * as userApi from './userApi';
export * as gameApi from './gameApi';
export * as tonApi from './tonApi';
export * as x10Api from './x10Api';

// Можно также экспортировать общие типы или вспомогательные функции
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Хелпер для обработки ошибок запроса
 * @param response - объект ответа fetch
 * @returns Текст ошибки или null, если ошибки нет
 */
export async function handleApiError(response: Response): Promise<string | null> {
  if (response.ok) {
    return null;
  }
  
  try {
    // Пытаемся получить JSON с ошибкой
    const data = await response.json();
    return data.error || data.message || `Ошибка ${response.status}: ${response.statusText}`;
  } catch {
    // Если не получилось, возвращаем текст ошибки
    try {
      const text = await response.text();
      return text || `Ошибка ${response.status}: ${response.statusText}`;
    } catch {
      // В крайнем случае возвращаем код ошибки
      return `Ошибка ${response.status}: ${response.statusText}`;
    }
  }
} 