import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import MatchX10 from '@/models/MatchX10';
import WaitingPlayerX10 from '@/models/WaitingPlayerX10';
import User from '@/models/User';
import { createErrorResponse, createSuccessResponse } from '@/utils/x10Utils';
import { X10_CONFIG } from '@/lib/config';
import type { X10Player } from '@/@types/x10';
import { broadcastGameStart } from '@/app/api/socket/x10/handlers';
import { getIO } from '@/app/api/socket/route';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Функция для создания матча из очереди
async function createMatchFromQueue() {
  // Начинаем транзакцию
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Получаем первых 10 игроков из очереди в рамках транзакции
    const players = await WaitingPlayerX10.find({
      ticketLocked: true, // Только игроки с заблокированными билетами
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: 1 })
      .limit(10)
      .session(session)
      .lean() as X10Player[];

    if (players.length === 10) {
      // Создаем новый матч
      const match = new MatchX10({
        players: players.map(p => ({
          telegramId: p.telegramId,
          username: p.username,
          chance: X10_CONFIG.TICKETS.GAME.COST,
          isReady: true
        })),
        status: 'playing',
        startedAt: new Date()
      });

      await match.save({ session });
      console.log(`[X10] Created new match ${match.matchId} with 10 players`);

      // Удаляем игроков из очереди
      const telegramIds = players.map(p => p.telegramId);
      await WaitingPlayerX10.deleteMany(
        { telegramId: { $in: telegramIds } },
        { session }
      );

      // Коммитим транзакцию
      await session.commitTransaction();

      // Отправляем уведомление через WebSocket
      const io = await getIO();
      if (io) {
        await broadcastGameStart(match);
        console.log(`[X10] Broadcasted game start for match ${match.matchId}`);
      }

      return match;
    }
    
    // Если недостаточно игроков, отменяем транзакцию
    await session.abortTransaction();
    return null;

  } catch (error) {
    // В случае ошибки отменяем транзакцию
    await session.abortTransaction();
    console.error('[X10] Error creating match from queue:', error);
    return null;
  } finally {
    // Завершаем сессию
    session.endSession();
  }
}

export async function POST(request: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();
    const { telegramId, username } = await request.json();

    if (!telegramId || !username) {
      return createErrorResponse('Missing required fields', 400);
    }

    // Проверяем баланс пользователя и сразу списываем билет
    const user = await User.findOne({ telegramId }).session(session);
    if (!user || user.tickets < X10_CONFIG.TICKETS.GAME.COST) {
      await session.abortTransaction();
      return createErrorResponse('Insufficient balance', 400);
    }

    // Списываем билет сразу используя правильное поле tickets
    user.tickets -= X10_CONFIG.TICKETS.GAME.COST;
    await user.save({ session });
    console.log(`[X10] Deducted ticket from player ${telegramId}, new balance:`, user.tickets);

    // Проверяем, не находится ли игрок уже в матче
    const activeMatch = await MatchX10.findOne({
      'players.telegramId': telegramId,
      status: 'playing'
    }).session(session);
    
    if (activeMatch) {
      // Возвращаем билет, если игрок уже в матче
      user.tickets += X10_CONFIG.TICKETS.GAME.COST;
      await user.save({ session });
      await session.abortTransaction();
      return createErrorResponse('Player already in active match', 400);
    }

    // Проверяем, не находится ли игрок уже в очереди
    const existingPlayer = await WaitingPlayerX10.findOne({ telegramId }).session(session);
    if (existingPlayer) {
      await WaitingPlayerX10.deleteOne({ telegramId }).session(session);
      console.log(`[X10] Removed existing player ${telegramId} from queue`);
    }

    // Создаем нового игрока в очереди
    const newPlayer = new WaitingPlayerX10({
      telegramId,
      username,
      chance: X10_CONFIG.TICKETS.GAME.COST,
      isReady: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 600000)
    });

    await newPlayer.save({ session });
    console.log(`[X10] Added player ${telegramId} to queue`);

    // Коммитим транзакцию
    await session.commitTransaction();

    // Проверяем, можно ли создать матч
    const updatedTotalPlayers = await WaitingPlayerX10.countDocuments({});
    if (updatedTotalPlayers >= 10) {
      const match = await createMatchFromQueue();
      if (match) {
        return createSuccessResponse({
          message: 'Match created successfully',
          data: { 
            matchId: match.matchId, 
            players: match.players,
            startedAt: match.startedAt,
            status: match.status
          }
        });
      }
    }

    return createSuccessResponse({
      message: 'Successfully joined the queue',
      data: { telegramId, username }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('[X10] Error in create route:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    session.endSession();
  }
} 