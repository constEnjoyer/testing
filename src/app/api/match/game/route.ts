import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Match from '@/models/Match';
import WaitingPlayer from '@/models/WaitingPlayer';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Интерфейс для ожидающего игрока (только для типизации)
interface IWaitingPlayer {
  playerId: mongoose.Types.ObjectId;
  telegramId: number;
  timestamp: Date;
  expiresAt: Date;
}

// Локальная функция для очистки "зависших" матчей и игроков в очереди ожидания
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
 * Очищаем записи ожидающих игроков старше 10 минут
 */
async function cleanupOldWaitingPlayers(): Promise<void> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const result = await WaitingPlayer.deleteMany({ timestamp: { $lt: tenMinutesAgo } });
    
    if (result.deletedCount > 0) {
      console.log(`[API match/game] Удалено ${result.deletedCount} устаревших записей из очереди ожидания`);
    }
  } catch (error) {
    console.error('[API match/game] Ошибка при очистке устаревших записей:', error);
  }
}

/**
 * POST-обработчик для создания новой игры или поиска оппонента
 * @param request - Запрос с данными пользователя
 * @returns {Promise<NextResponse>} - Ответ с данными игры или ошибкой
 */
export async function POST(request: Request): Promise<NextResponse> {
  console.log('[API match/game] Получен запрос на поиск/создание игры');
  
  try {
    // Очищаем устаревшие матчи и записи ожидающих игроков
    await cleanupStalledMatches();
    
    // Подключаемся к БД
    await connectToDatabase();
    
    // Получаем данные из запроса
    const data = await request.json();
    const { telegramId } = data;
    
    if (!telegramId) {
      return NextResponse.json({
        success: false,
        error: 'ID Telegram не указан'
      }, { status: 400 });
    }
    
    // Проверяем, существует ли пользователь
    const user = await User.findOne({ telegramId });
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Пользователь не найден'
      }, { status: 404 });
    }
    
    // Проверяем баланс билетов
    if (user.tickets < 1) {
      return NextResponse.json({
        success: false,
        error: 'Недостаточно билетов'
      }, { status: 400 });
    }
    
    // Проверяем, есть ли уже активный матч для этого пользователя
    const existingMatch = await Match.findOne({
      $or: [
        { player1Id: telegramId },
        { player2Id: telegramId }
      ],
      status: { $in: ['waiting', 'matched'] }
    });
    
    if (existingMatch) {
      console.log(`[API match/game] Пользователь ${telegramId} уже имеет активный матч`);
      return NextResponse.json({
        success: true,
        status: existingMatch.status,
        match: {
          matchId: existingMatch.matchId,
          player1Id: existingMatch.player1Id,
          player1Name: existingMatch.player1Name,
          player2Id: existingMatch.player2Id,
          player2Name: existingMatch.player2Name,
          ticketsAmount: existingMatch.ticketsAmount,
          createdAt: existingMatch.createdAt
        }
      });
    }
    
    // Проверяем, есть ли пользователь в списке ожидания
    let waitingPlayer = await WaitingPlayer.findOne({ telegramId });
    
    if (waitingPlayer) {
      console.log(`[API match/game] Пользователь ${telegramId} уже находится в очереди ожидания`);
      
      // Получаем количество ожидающих игроков (для статистики)
      const waitingPlayersCount = await WaitingPlayer.countDocuments();
      
      return NextResponse.json({
        success: true,
        status: 'waiting',
        isWaiting: true,
        playersCount: waitingPlayersCount,
        message: 'Ожидание соперника продолжается'
      });
    }
    
    // Ищем другого игрока, ожидающего матча
    const opponent = await WaitingPlayer.findOne({ telegramId: { $ne: telegramId } });
    
    if (opponent) {
      // Нашли оппонента, удаляем его из списка ожидания
      await WaitingPlayer.deleteOne({ _id: opponent._id });
      
      // Получаем данные оппонента
      const opponentUser = await User.findOne({ telegramId: opponent.telegramId });
      
      if (!opponentUser) {
        console.error(`[API match/game] Не найдены данные пользователя для оппонента: ${opponent.telegramId}`);
        return NextResponse.json({
          success: false,
          error: 'Данные оппонента не найдены'
        }, { status: 500 });
      }
      
      // Создаем новый матч
      const newMatch = new Match({
        matchId: uuidv4(),
        player1Id: telegramId,
        player1Name: user.firstName,
        player2Id: opponent.telegramId,
        player2Name: opponentUser.firstName,
        ticketsAmount: 1, // Базовая ставка
        status: 'matched'
      });
      
      await newMatch.save();
      console.log(`[API match/game] Создан новый матч между ${telegramId} и ${opponent.telegramId}`);
      
      // Списываем билет с обоих пользователей
      user.tickets -= 1;
      await user.save();
      
      opponentUser.tickets -= 1;
      await opponentUser.save();
      
      return NextResponse.json({
        success: true,
        status: 'matched',
        match: {
          matchId: newMatch.matchId,
          player1Id: newMatch.player1Id,
          player1Name: newMatch.player1Name,
          player2Id: newMatch.player2Id,
          player2Name: newMatch.player2Name,
          ticketsAmount: newMatch.ticketsAmount,
          createdAt: newMatch.createdAt
        }
      });
    } else {
      // Не нашли оппонента, добавляем игрока в список ожидания
      const newWaitingPlayer = new WaitingPlayer({
        playerId: user._id,
        telegramId: telegramId,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 минут
      });
      
      await newWaitingPlayer.save();
      console.log(`[API match/game] Пользователь ${telegramId} добавлен в очередь ожидания`);
      
      return NextResponse.json({
        success: true,
        status: 'waiting',
        isWaiting: true,
        playersCount: 1,
        message: 'Ожидание соперника'
      });
    }
  } catch (error) {
    console.error('[API match/game] Ошибка при создании матча:', error);
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
}

/**
 * GET-обработчик для проверки статуса матча
 * @param request - Запрос с параметрами запроса
 * @returns {Promise<NextResponse>} - Ответ с данными матча или ошибкой
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Очищаем устаревшие матчи и записи ожидающих игроков
    await cleanupStalledMatches();
    
    // Подключаемся к БД
    await connectToDatabase();
    
    // Получаем telegramId из параметров запроса
    const url = new URL(request.url);
    const telegramId = Number(url.searchParams.get('telegramId'));
    
    if (!telegramId) {
      return NextResponse.json({
        success: false,
        error: 'ID Telegram не указан'
      }, { status: 400 });
    }
    
    // Проверяем, существует ли пользователь
    const user = await User.findOne({ telegramId });
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Пользователь не найден'
      }, { status: 404 });
    }
    
    // Проверяем наличие активного матча
    const match = await Match.findOne({
      $or: [
        { player1Id: telegramId },
        { player2Id: telegramId }
      ],
      status: { $in: ['waiting', 'matched'] }
    });
    
    // Проверяем, есть ли пользователь в списке ожидания
    const waitingPlayer = await WaitingPlayer.findOne({ telegramId });
    
    // Подсчитываем количество ожидающих игроков
    const waitingPlayersCount = await WaitingPlayer.countDocuments();
    
    if (match) {
      // Нашли активный матч
      console.log(`[API match/game] Найден активный матч для ${telegramId}: ${match.matchId}`);
      
      return NextResponse.json({
        success: true,
        status: match.status,
        match: {
          matchId: match.matchId,
          player1Id: match.player1Id,
          player1Name: match.player1Name,
          player2Id: match.player2Id,
          player2Name: match.player2Name,
          ticketsAmount: match.ticketsAmount,
          createdAt: match.createdAt
        }
      });
    } else if (waitingPlayer) {
      // Пользователь в списке ожидания
      console.log(`[API match/game] Пользователь ${telegramId} находится в очереди ожидания`);
      
      return NextResponse.json({
        success: true,
        status: 'waiting',
        isWaiting: true,
        playersCount: waitingPlayersCount,
        message: 'Ожидание соперника'
      });
    } else {
      // Пользователь не в матче и не в очереди
      console.log(`[API match/game] Пользователь ${telegramId} не в матче и не в очереди`);
      
      return NextResponse.json({
        success: true,
        status: 'available',
        isWaiting: false,
        playersCount: waitingPlayersCount,
        message: 'Готов к игре'
      });
    }
  } catch (error) {
    console.error('[API match/game] Ошибка при проверке статуса:', error);
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
} 