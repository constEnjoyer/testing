/**
 * Утилиты для работы с хранилищем данных в браузере
 */

// Константы для ключей хранилища (чтобы не разбрасывать строковые литералы по коду)
export const STORAGE_KEYS = {
  // Локализация
  APP_LOCALE: 'app-locale',
  HANDLING_LOCALE: 'handling-locale',
  
  // Пользовательские данные
  TELEGRAM_USER_ID: 'telegram-user-id',
  USER_DATA: 'user-data',
  
  // Реферальная система
  REFERRAL_PARAM: 'referral_param',
  REFERRAL_PROCESSED: 'referral_processed',
  
  // Состояние интерфейса
  MENU_STATE: 'menuState',
  HAS_VISITED_GAME_ROOM: 'hasVisitedGameRoom',
  
  // Настройки звука
  SOUND_MUTED: 'sound-muted',
  BACKGROUND_MUSIC_POSITION: 'background-music-position',
  
  // Настройки окружения
  ENV_MOCKED: 'env-mocked'
};

/**
 * Сохраняет данные в localStorage
 * @param key Ключ для сохранения
 * @param value Значение для сохранения
 * @returns true в случае успеха, false при ошибке
 */
export function saveToLocalStorage(key: string, value: any): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    
    window.localStorage.setItem(key, 
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return true;
  } catch (error) {
    console.error(`[StorageUtils] Ошибка сохранения в localStorage по ключу "${key}":`, error);
    return false;
  }
}

/**
 * Получает данные из localStorage
 * @param key Ключ для получения данных
 * @param defaultValue Значение по умолчанию
 * @returns Значение из localStorage или defaultValue при ошибке
 */
export function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    
    try {
      // Пробуем распарсить как JSON
      return JSON.parse(item);
    } catch {
      // Если не получилось, возвращаем как есть
      return item as any;
    }
  } catch (error) {
    console.error(`[StorageUtils] Ошибка чтения из localStorage по ключу "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Удаляет данные из localStorage
 * @param key Ключ для удаления
 * @returns true в случае успеха, false при ошибке
 */
export function removeFromLocalStorage(key: string): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[StorageUtils] Ошибка удаления из localStorage по ключу "${key}":`, error);
    return false;
  }
}

/**
 * Сохраняет данные в sessionStorage
 * @param key Ключ для сохранения
 * @param value Значение для сохранения
 * @returns true в случае успеха, false при ошибке
 */
export function saveToSessionStorage(key: string, value: any): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    
    window.sessionStorage.setItem(key, 
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return true;
  } catch (error) {
    console.error(`[StorageUtils] Ошибка сохранения в sessionStorage по ключу "${key}":`, error);
    return false;
  }
}

/**
 * Получает данные из sessionStorage
 * @param key Ключ для получения данных
 * @param defaultValue Значение по умолчанию
 * @returns Значение из sessionStorage или defaultValue при ошибке
 */
export function getFromSessionStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    const item = window.sessionStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    
    try {
      // Пробуем распарсить как JSON
      return JSON.parse(item);
    } catch {
      // Если не получилось, возвращаем как есть
      return item as any;
    }
  } catch (error) {
    console.error(`[StorageUtils] Ошибка чтения из sessionStorage по ключу "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Удаляет данные из sessionStorage
 * @param key Ключ для удаления
 * @returns true в случае успеха, false при ошибке
 */
export function removeFromSessionStorage(key: string): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    
    window.sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[StorageUtils] Ошибка удаления из sessionStorage по ключу "${key}":`, error);
    return false;
  }
} 