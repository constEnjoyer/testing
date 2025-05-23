import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import MatchX10 from '@/models/MatchX10';
import User from '@/models/User';
import { X10_CONFIG } from '@/lib/config';
import { createErrorResponse, createSuccessResponse } from '@/utils/x10Utils';
import { X10ApiResponse, X10Player } from '@/@types/x10';
import { MAX_PLAYERS } from '@/lib/config';
import type { GameResponse } from '@/app/api/match/x10Models';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

type GameStatus = 'in_match' | 'idle';

// Кэшируем статические данные
const STATIC_GAME_CONFIG = {
  maxPlayers: MAX_PLAYERS,
  ticketCost: X10_CONFIG.TICKETS.GAME.COST,
  prizes: {
    first: X10_CONFIG.PRIZES.FIRST,
    second: X10_CONFIG.PRIZES.SECOND,
    third: X10_CONFIG.PRIZES.THIRD
  }
};

/**
 * Получает текущий статус игры для пользователя
 * @param req - HTTP запрос с параметром telegramId
 * @returns Ответ с текущим статусом игры
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = Number(searchParams.get('telegramId'));

    if (!telegramId) {
      return NextResponse.json({
        success: false,
        error: 'Не указан telegramId'
      }, { status: 400 });
    }

    await connectToDatabase();

    // Проверяем все состояния одним запросом
    const [activeMatch, user] = await Promise.all([
      MatchX10.findOne({
        'players.telegramId': telegramId,
        status: { $in: ['waiting', 'playing'] }
      }).select('matchId status players').lean(),
      User.findOne({ telegramId }).select('balance.tickets').lean()
    ]);

    // Игрок в активной игре
    if (activeMatch) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'in_match' as GameStatus,
          matchId: activeMatch.matchId,
          players: activeMatch.players,
          gameStatus: activeMatch.status
        }
      });
    }

    // Проверяем очередь ожидания
    const waitingCount = await User.countDocuments({
      'balance.tickets': { $gte: 1 },
      telegramId: { $ne: telegramId }
    });

    // Игрок не в игре
    return NextResponse.json({
      success: true,
      data: {
        status: 'idle' as GameStatus,
        waitingCount,
        ...STATIC_GAME_CONFIG,
        canPlay: user?.balance?.tickets >= X10_CONFIG.TICKETS.GAME.COST
      }
    });

  } catch (error) {
    console.error('[X10] Ошибка при получении статуса игры:', error);
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
}