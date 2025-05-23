import { useRef } from 'react';

/**
 * Хук для однократного выполнения функции на клиенте
 * @param fn Функция для выполнения
 * @returns Результат выполнения функции или undefined, если выполнение не произошло
 */
export function useClientOnce<T>(fn: () => T): T | undefined {
  const canCall = useRef(true);
  const result = useRef<T | undefined>(undefined);
  
  if (typeof window !== 'undefined' && canCall.current) {
    canCall.current = false;
    result.current = fn();
  }
  
  return result.current;
}