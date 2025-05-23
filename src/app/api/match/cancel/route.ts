import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';
import Match from '@/models/Match';
import WaitingPlayer from '@/models/WaitingPlayer';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Функция для очистки "зависших" матчей и игроков в очереди ожидания
// Эта функция теперь приватная для этого модуля
async function cleanupStalledMatches() {
  try {
    await connectToDatabase();
    
    // Устанавливаем порог времени для устаревших записей (2 минуты)
    const timeoutThreshold = new Date(Date.now() - 2 * 60 * 1000);
    
    // Обновляем статус матчей, которые "зависли" в статусе ожидания или сопоставления
    const canceledMatches = await Match.updateMany(
      { 
        status: { $in: ['waiting', 'matched'] },
        createdAt: { $lt: timeoutThreshold }
      },
      { $set: { status: 'canceled' } }
    );
    
    // Удаляем игроков из очереди ожидания, которые там "зависли"
    const deletedWaitingPlayers = await WaitingPlayer.deleteMany({
      createdAt: { $lt: timeoutThreshold }
    });
    
    return {
      success: true,
      canceledMatches,
      deletedWaitingPlayers
    };
  } catch (error: any) {
    console.error('Ошибка при очистке устаревших матчей:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * POST-обработчик для отмены ожидания игры
 * @param request - Запрос с данными пользователя
 * @returns {Promise<NextResponse>} - Ответ с результатом отмены или ошибкой
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Очищаем устаревшие матчи и игроков в очереди
    await cleanupStalledMatches();
    
    // Получаем данные из запроса
    const data = await request.json();
    const { telegramId } = data;
    
    if (!telegramId) {
      return NextResponse.json(
        { success: false, error: 'Не указан telegramId' },
        { status: 400 }
      );
    }
    
    // Проверяем, есть ли активный матч для этого игрока
    const existingMatch = await Match.findOne({
      $or: [
        { player1Id: telegramId, status: { $in: ['waiting', 'matched'] } },
        { player2Id: telegramId, status: { $in: ['waiting', 'matched'] } }
      ]
    });
    
    if (existingMatch) {
      // Если матч уже создан, отменяем его
      existingMatch.status = 'canceled';
      await existingMatch.save();
      return NextResponse.json({ 
        success: true, 
        message: 'Матч отменен',
        matchExists: true
      });
    }
    
    // Удаляем игрока из очереди ожидания
    const result = await WaitingPlayer.deleteOne({ telegramId });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Поиск игры отменен',
      removed: result.deletedCount > 0,
      matchExists: false
    });
  } catch (error: any) {
    console.error('Ошибка при отмене поиска игры:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET-обработчик для проверки статуса системы и очистки старых матчей
 * @returns {Promise<NextResponse>} - Ответ с результатом очистки
 */
export async function GET() {
  const result = await cleanupStalledMatches();
  
  return NextResponse.json(result);
} 