import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Список всех коллекций, которые должны существовать в базе данных
const requiredCollections = [
  'users',            // Основная коллекция пользователей 
  'userHistory',      // История пользователей
  'withdrawRequests', // Запросы на вывод средств
  'matches',          // Информация об играх
  'referrals',        // Коллекция для реферальной системы
  'waitingPlayers',   // Игроки в ожидании игры
  'privaterooms',     // Приватные комнаты
  'matchConfirmations' // Подтверждения игр
];

/**
 * Обработчик GET запросов для инициализации коллекций
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с результатом инициализации
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[API init-collections] Запрос на инициализацию коллекций базы данных');
    
    // Подключаемся к базе данных
    const { db, connection } = await connectToDatabase();
    if (!db) {
      console.error('[API init-collections] Не удалось подключиться к базе данных');
      return NextResponse.json({ 
        success: false, 
        error: 'Не удалось подключиться к базе данных' 
      }, { status: 500 });
    }
    
    console.log('[API init-collections] Подключение к базе данных установлено');
    
    // Получаем список существующих коллекций
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map((collection: { name: string }) => collection.name);
    
    console.log('[API init-collections] Существующие коллекции:', existingCollectionNames);
    
    // Создаем недостающие коллекции
    const createdCollections = [];
    const failedCollections = [];
    
    for (const collectionName of requiredCollections) {
      if (!existingCollectionNames.includes(collectionName)) {
        try {
          await db.createCollection(collectionName);
          console.log(`[API init-collections] Создана коллекция ${collectionName}`);
          createdCollections.push(collectionName);
        } catch (error) {
          console.error(`[API init-collections] Ошибка создания коллекции ${collectionName}:`, error);
          failedCollections.push(collectionName);
        }
      }
    }
    
    // Проверяем наличие индексов в коллекции users
    try {
      const usersCollection = db.collection('users');
      const indexes = await usersCollection.indexes();
      const hasTelegramIdIndex = indexes.some((index: any) => 
        index.key && index.key.telegramId === 1 && index.unique === true
      );
      
      if (!hasTelegramIdIndex) {
        await usersCollection.createIndex({ telegramId: 1 }, { unique: true });
        console.log('[API init-collections] Создан уникальный индекс для telegramId в коллекции users');
      }
    } catch (indexError) {
      console.error('[API init-collections] Ошибка при проверке/создании индексов:', indexError);
    }
    
    // Формируем ответ
    return NextResponse.json({ 
      success: true, 
      data: {
        existingCollections: existingCollectionNames,
        createdCollections,
        failedCollections
      }
    });
    
  } catch (error: any) {
    console.error('[API init-collections] Ошибка при инициализации коллекций:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Ошибка при инициализации коллекций' 
    }, { status: 500 });
  }
} 