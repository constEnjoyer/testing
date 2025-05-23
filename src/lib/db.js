import mongoose from 'mongoose';
import { CONFIG } from './config';
import { NextResponse } from 'next/server';

const MONGODB_URI = CONFIG.MONGODB_URI;

// Логгирование информации о подключении
console.log('[DB] Строка подключения MongoDB (без пароля):', MONGODB_URI?.includes('@') ? MONGODB_URI.split('@')[1] : 'Не задана');
console.log('[DB] Кластер в URI:', MONGODB_URI?.includes('cluster0') ? 'cluster0' : 'Нет кластера');

// Кеш подключения к MongoDB для повторного использования между функциями API
let cachedConnection = null;

// Функция, определяющая окружение выполнения
function isServerSideRendering() {
  // Vercel использует переменную VERCEL=1 в production среде
  return !process.env.VERCEL && process.env.NODE_ENV === 'development' && typeof window === 'undefined' && !global.isConnecting;
}

/**
 * Подключение к MongoDB, с кешированием соединения
 * @returns {Promise<{db: any, connection: typeof mongoose}>} Mongoose connection и объект базы данных
 */
export async function connectToDatabase() {
  console.log('[DB] Инициализация кеша подключения к MongoDB');
  
  // Проверяем наличие строки подключения
  if (!MONGODB_URI) {
    console.error('[DB] ОШИБКА: MONGODB_URI не установлен. Проверьте переменные окружения');
    throw new Error('[DB] MONGODB_URI не установлен');
  }
  
  // Если окружение серверного рендеринга, не подключаемся к базе данных
  if (isServerSideRendering()) {
    console.log('[DB] Пропускаем подключение к MongoDB во время серверного рендеринга');
    return { db: null, connection: null };
  }

  // Если соединение уже установлено или в процессе установки, используем его
  if (cachedConnection) {
    console.log('[DB] Используем существующее подключение к MongoDB');
    return { 
      db: cachedConnection.connection.db,
      connection: cachedConnection 
    };
  }

  try {
    console.log('[DB] Устанавливаем новое подключение к MongoDB...');
    
    // Устанавливаем флаг подключения, чтобы избежать параллельных подключений
    global.isConnecting = true;
    
    // Устанавливаем соединение
    const options = {
      connectTimeoutMS: 10000, // 10 секунд таймаут
      serverSelectionTimeoutMS: 10000, // 10 секунд таймаут
    };
    
    cachedConnection = await mongoose.connect(MONGODB_URI, options);
    console.log('[DB] Успешно подключились к MongoDB!');
    
    // Сбрасываем флаг подключения
    global.isConnecting = false;
    
    return { 
      db: cachedConnection.connection.db,
      connection: cachedConnection 
    };
  } catch (error) {
    console.error('[DB] ОШИБКА подключения к MongoDB:', error.message);
    
    // Сбрасываем флаг подключения и кеш при ошибке
    global.isConnecting = false;
    cachedConnection = null;
    
    throw error;
  }
}

/**
 * Обертка для API маршрутов Next.js App Router, которая обеспечивает подключение к базе данных 
 * перед выполнением обработчика
 * @param {Function} handler Функция обработчик API запроса
 * @returns {Function} Обернутая функция с подключением к базе данных
 */
export function ensureDbConnected(handler) {
  return async (request, context) => {
    try {
      await connectToDatabase();
      return handler(request, context);
    } catch (error) {
      console.error('[DB] Ошибка в обработчике API:', error.message);
      return NextResponse.json({ error: 'Ошибка подключения к базе данных' }, { status: 500 });
    }
  };
}

export default mongoose; 