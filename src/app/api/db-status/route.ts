import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

/**
 * GET-запрос для проверки статуса подключения к базе данных
 * @returns {Promise<NextResponse>} - Ответ с статусом подключения
 */
export async function GET(): Promise<NextResponse> {
  try {
    console.log('[API db-status] Получен запрос на проверку статуса БД');
    
    // Проверяем подключение к БД
    let isConnected = false;
    try {
      await connectToDatabase();
      isConnected = mongoose.connection.readyState === 1;
      console.log('[API db-status] Статус подключения:', isConnected ? 'connected' : 'disconnected');
    } catch (dbError) {
      console.error('[API db-status] Ошибка подключения к БД:', dbError);
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: dbError instanceof Error ? dbError.message : 'Ошибка подключения к БД'
      }, { status: 500 });
    }
    
    // Получаем дополнительную информацию о БД
    let dbInfo = {};
    
    if (isConnected) {
      try {
        const connection = mongoose.connection;
        
        // Получаем список коллекций
        const db = connection.db;
        if (db) {
          // Получаем список коллекций
          const collections = await db.listCollections().toArray();
          
          const dbInfo = {
            status: 'ok',
            databases: [connection.name],
            currentDb: connection.name,
            host: connection.host,
            port: connection.port,
            models: Object.keys(mongoose.models),
            collections: collections.map((c: any) => c.name),
            readyState: connection.readyState,
            readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][connection.readyState] || 'unknown'
          };
          
          console.log('[API db-status] Информация о БД:', JSON.stringify(dbInfo));
        } else {
          console.log('[API db-status] Объект db не доступен');
        }
      } catch (dbError) {
        console.error('[API db-status] Ошибка при получении информации о БД:', dbError);
      }
    }
    
    return NextResponse.json({
      status: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      dbInfo
    });
  } catch (error) {
    console.error('[API db-status] Ошибка при проверке статуса БД:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 });
  }
} 