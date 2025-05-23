import { connectToDatabase } from '@/lib/db';

/**
 * Функция, которая обеспечивает подключение к базе данных перед выполнением API-запросов
 * Возвращает true, если подключение установлено успешно, иначе false
 */
export async function checkDbConnection() {
  console.log('[Database] Инициализация подключения к MongoDB при запуске');
  
  try {
    console.log('[Database] Попытка подключения к MongoDB...');
    
    await connectToDatabase();
    console.log('[Database] Успешно подключились к MongoDB');
    console.log('[Database] Результат инициализации подключения: успешно');
    return true;
  } catch (error) {
    console.error('[Database] Ошибка при подключении к MongoDB:', error);
    console.log('[Database] Результат инициализации подключения: ошибка');
    return false;
  }
} 