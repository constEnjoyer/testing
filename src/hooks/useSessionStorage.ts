import { useState, useEffect, useCallback } from 'react';
import { getFromSessionStorage, saveToSessionStorage } from '../utils/storageUtils';

/**
 * Хук для работы с sessionStorage
 * @param key - Ключ для хранения данных
 * @param initialValue - Начальное значение
 * @returns [storedValue, setValue] - Хранимое значение и функция для его изменения
 */
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Получаем значение из sessionStorage или используем initialValue
  const readValue = useCallback((): T => {
    return getFromSessionStorage<T>(key, initialValue);
  }, [key, initialValue]);

  // Состояние для хранения значения
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Функция для обновления значения в sessionStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Разрешаем передавать функцию для обновления значения
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Сохраняем в состоянии
      setStoredValue(valueToStore);
      
      // Сохраняем в sessionStorage
      if (typeof window !== 'undefined') {
        saveToSessionStorage(key, valueToStore);
        
        // Вызываем событие для обновления компонентов
        window.dispatchEvent(new Event('session-storage'));
      }
    } catch (error) {
      console.warn(`[useSessionStorage] Ошибка записи sessionStorage ключа "${key}":`, error);
    }
  };

  // Слушаем изменения
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };
    
    // Слушаем события storage и custom event
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('session-storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('session-storage', handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue];
} 