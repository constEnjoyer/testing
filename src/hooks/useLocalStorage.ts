import { useState, useEffect, useCallback } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../utils/storageUtils';

/**
 * Хук для работы с localStorage
 * @param key - Ключ для хранения данных
 * @param initialValue - Начальное значение
 * @returns [storedValue, setValue] - Хранимое значение и функция для его изменения
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Получаем значение из localStorage или используем initialValue
  const readValue = useCallback((): T => {
    return getFromLocalStorage<T>(key, initialValue);
  }, [key, initialValue]);

  // Состояние для хранения значения
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Функция для обновления значения в localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Разрешаем передавать функцию для обновления значения
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Сохраняем в состоянии
      setStoredValue(valueToStore);
      
      // Сохраняем в localStorage
      if (typeof window !== 'undefined') {
        saveToLocalStorage(key, valueToStore);
        
        // Вызываем событие для синхронизации между вкладками
        window.dispatchEvent(new Event('local-storage'));
      }
    } catch (error) {
      console.warn(`[useLocalStorage] Ошибка записи localStorage ключа "${key}":`, error);
    }
  };

  // Слушаем изменения в других вкладках
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };
    
    // Слушаем события storage и custom event
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue];
} 