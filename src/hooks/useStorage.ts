'use client';

import { useState, useCallback, useEffect } from 'react';

// Типы хранилищ
type StorageType = 'local' | 'session';

// Интерфейс для хука
interface UseStorageReturnType<T> {
  value: T | null;
  setValue: (value: T) => void;
  removeValue: () => void;
  error: Error | null;
}

/**
 * Хук для работы с localStorage и sessionStorage с типизацией и обработкой ошибок
 * @param key - Ключ для хранения
 * @param initialValue - Начальное значение (опционально)
 * @param storageType - Тип хранилища: 'local' (localStorage) или 'session' (sessionStorage)
 * @returns Объект с текущим значением, функциями для установки и удаления, и информацией об ошибках
 */
export function useStorage<T>(
  key: string,
  initialValue: T | null = null,
  storageType: StorageType = 'local'
): UseStorageReturnType<T> {
  // Функция для получения значения из хранилища
  const getStoredValue = useCallback((): T | null => {
    // Проверяем, что мы находимся в браузере
    if (typeof window === 'undefined') {
      return initialValue;
    }

    // Выбираем нужный тип хранилища
    const storage = storageType === 'local' ? localStorage : sessionStorage;

    try {
      const item = storage.getItem(key);
      
      // Если элемент не найден, возвращаем начальное значение
      if (item === null) {
        return initialValue;
      }
      
      // Пытаемся распарсить JSON
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[useStorage] Ошибка при получении ${key} из ${storageType}Storage:`, error);
      return initialValue;
    }
  }, [key, initialValue, storageType]);

  // Состояние для хранения текущего значения и ошибки
  const [value, setValue] = useState<T | null>(() => getStoredValue());
  const [error, setError] = useState<Error | null>(null);

  // Функция для установки значения в хранилище
  const saveValue = useCallback((newValue: T): void => {
    // Проверяем, что мы находимся в браузере
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Обновляем состояние React
      setValue(newValue);
      setError(null);

      // Выбираем нужный тип хранилища
      const storage = storageType === 'local' ? localStorage : sessionStorage;
      
      // Сохраняем в хранилище
      storage.setItem(key, JSON.stringify(newValue));
      
      // Создаем событие для синхронизации между вкладками (только для localStorage)
      if (storageType === 'local') {
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: JSON.stringify(newValue)
        }));
      }
    } catch (error) {
      console.error(`[useStorage] Ошибка при сохранении ${key} в ${storageType}Storage:`, error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [key, storageType]);

  // Функция для удаления значения из хранилища
  const removeValue = useCallback((): void => {
    // Проверяем, что мы находимся в браузере
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Обновляем состояние React
      setValue(null);
      setError(null);

      // Выбираем нужный тип хранилища
      const storage = storageType === 'local' ? localStorage : sessionStorage;
      
      // Удаляем из хранилища
      storage.removeItem(key);
      
      // Создаем событие для синхронизации между вкладками (только для localStorage)
      if (storageType === 'local') {
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: null
        }));
      }
    } catch (error) {
      console.error(`[useStorage] Ошибка при удалении ${key} из ${storageType}Storage:`, error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [key, storageType]);

  // Слушаем события изменения хранилища для синхронизации между вкладками
  useEffect(() => {
    if (typeof window === 'undefined' || storageType !== 'local') {
      return;
    }

    // Обработчик события
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          // Если значение удалено
          if (event.newValue === null) {
            setValue(null);
          } 
          // Если значение обновлено
          else {
            setValue(JSON.parse(event.newValue) as T);
          }
          setError(null);
        } catch (error) {
          console.error(`[useStorage] Ошибка при обработке события storage для ${key}:`, error);
          setError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    // Подписываемся на события
    window.addEventListener('storage', handleStorageChange);

    // Отписываемся при размонтировании
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, storageType]);

  return { value, setValue: saveValue, removeValue, error };
}

// Константы для ключей хранилища - переносим из storageUtils
export const STORAGE_KEYS = {
  USER_ID: 'user_id',
  HAS_VISITED_GAME_ROOM: 'has_visited_game_room',
  MENU_STATE: 'menu_state',
  GAME_STATE: 'game_state',
  GAME_STATE_X10: 'game_state_x10',
  GAME_ROOM_STATE: 'game_room_state',
  SOUND_MUTED: 'sound_muted',
  PREFERRED_LOCALE: 'preferred_locale',
}; 