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
  'matchConfirmations', // Подтверждения игр
  'matchesx10',       // Матчи режима X10
  'waitingplayersx10' // Игроки в ожидании для X10 режима
];

/**
 * Обработчик GET запросов для форсированной инициализации коллекций
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с результатом инициализации
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[API debug/create-collections] Принудительное создание коллекций');
    
    // Подключаемся к базе данных
    const { db, connection } = await connectToDatabase();
    if (!db) {
      console.error('[API debug/create-collections] Не удалось подключиться к базе данных');
      return NextResponse.json({ 
        success: false, 
        error: 'Не удалось подключиться к базе данных' 
      }, { status: 500 });
    }
    
    console.log('[API debug/create-collections] Подключение к базе данных установлено');
    
    // Получаем список существующих коллекций
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map((collection: { name: string }) => collection.name);
    
    console.log('[API debug/create-collections] Существующие коллекции:', existingCollectionNames);
    
    // Создаем все коллекции независимо от того, существуют они или нет
    const results = [];
    
    for (const collectionName of requiredCollections) {
      try {
        // Удаляем коллекцию, если она существует
        if (existingCollectionNames.includes(collectionName)) {
          console.log(`[API debug/create-collections] Коллекция ${collectionName} существует, пропускаем`);
          results.push({ name: collectionName, status: 'exists' });
          continue;
        }
        
        // Создаем коллекцию
        await db.createCollection(collectionName);
        console.log(`[API debug/create-collections] Создана коллекция ${collectionName}`);
        results.push({ name: collectionName, status: 'created' });
      } catch (error) {
        console.error(`[API debug/create-collections] Ошибка создания коллекции ${collectionName}:`, error);
        results.push({ 
          name: collectionName, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
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
        console.log('[API debug/create-collections] Создан уникальный индекс для telegramId в коллекции users');
        results.push({ name: 'users.index.telegramId', status: 'created' });
      } else {
        results.push({ name: 'users.index.telegramId', status: 'exists' });
      }
    } catch (indexError) {
      console.error('[API debug/create-collections] Ошибка при проверке/создании индексов:', indexError);
      results.push({ 
        name: 'users.index', 
        status: 'failed', 
        error: indexError instanceof Error ? indexError.message : 'Unknown error' 
      });
    }
    
    // Получаем обновленный список коллекций
    const updatedCollections = await db.listCollections().toArray();
    const updatedCollectionNames = updatedCollections.map((collection: { name: string }) => collection.name);
    
    // Формируем ответ
    return NextResponse.json({ 
      success: true, 
      data: {
        existingCollections: existingCollectionNames,
        currentCollections: updatedCollectionNames,
        results
      }
    });
    
  } catch (error: any) {
    console.error('[API debug/create-collections] Ошибка при инициализации коллекций:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Ошибка при инициализации коллекций' 
    }, { status: 500 });
  }
} 