import { useState, useEffect, useCallback } from 'react';

/**
 * Хук для автоматического выполнения запросов к API с интервалами
 * @param fetchFunction - Функция для выполнения запроса
 * @param interval - Интервал между запросами в миллисекундах (по умолчанию 10000 мс)
 * @param initialFetch - Выполнять ли запрос сразу при монтировании (по умолчанию true)
 * @returns Объект с состоянием загрузки, данными, ошибкой и функцией для принудительного обновления
 */
export function useAutoFetch<T>(
  fetchFunction: () => Promise<T>,
  interval = 10000,
  initialFetch = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(initialFetch);
  const [error, setError] = useState<Error | null>(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      console.error('[useAutoFetch] Ошибка при выполнении запроса:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  // Выполняем запрос при монтировании и периодически
  useEffect(() => {
    if (initialFetch) {
      doFetch();
    }
    
    // Настраиваем интервал для периодического обновления
    const intervalId = setInterval(doFetch, interval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [doFetch, interval, initialFetch]);

  return {
    loading,
    data,
    error,
    refetch: doFetch
  };
} 