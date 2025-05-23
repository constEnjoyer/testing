import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import MatchX10 from '@/models/MatchX10';
import User from '@/models/User';
import { X10_CONFIG } from '@/lib/config';
import type { X10ApiResponse, X10Winner, X10Player } from '@/@types/x10';
import { ReferralService } from '@/lib/referral';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Вспомогательные функции
const createErrorResponse = (error: string, status: number = 500): NextResponse => {
  return NextResponse.json({ success: false, error }, { status });
};

const createSuccessResponse = (data: any): NextResponse => {
  return NextResponse.json({ success: true, ...data });
};

// Валидация победителей
function validateWinners(winners: X10Winner[]): boolean {
  if (!Array.isArray(winners) || winners.length !== X10_CONFIG.WINNERS_COUNT) {
    return false;
  }

  const validPrizes = [X10_CONFIG.PRIZES.FIRST, X10_CONFIG.PRIZES.SECOND, X10_CONFIG.PRIZES.THIRD];
  const validPositions = [1, 2, 3] as const;

  return winners.every((winner, index) => {
    return (
      typeof winner.telegramId === 'number' &&
      typeof winner.username === 'string' &&
      winner.prize === validPrizes[index] &&
      winner.position === validPositions[index]
    );
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { matchId, telegramId } = body;
    let { winners } = body;

    if (!matchId) {
      return createErrorResponse('Match ID is required', 400);
    }

    await connectToDatabase();

    // ШАГ 1: Проверяем, был ли матч уже завершен (кэширование результатов)
    console.log(`[X10 Complete] Проверяем статус матча: ${matchId}`);
    const existingMatch = await MatchX10.findOne({ matchId }).maxTimeMS(5000);
    
    if (!existingMatch) {
      return createErrorResponse('Match not found', 404);
    }
    
    // Если матч уже завершен, возвращаем существующие результаты
    if (existingMatch.status === 'completed') {
      console.log(`[X10 Complete] Матч ${matchId} уже завершен, возвращаем кэшированные результаты`);
      return createSuccessResponse({
        matchId,
        status: 'completed',
        completedAt: existingMatch.completedAt,
        winners: existingMatch.winners?.filter((w: any) => w.position > 0) || []
      });
    }
    
    // Проверяем статус матча
    if (existingMatch.status !== 'playing') {
      return createErrorResponse(`Match is not in playing state: ${existingMatch.status}`, 400);
    }

    // Проверяем что матч не просрочен
    if (existingMatch.timeoutAt && existingMatch.timeoutAt < new Date()) {
      try {
        await MatchX10.updateOne(
          { matchId },
          { 
            $set: { 
              status: 'canceled',
              cancelReason: 'timeout'
            }
          },
          { maxTimeMS: 3000 }
        );
      } catch (err) {
        console.error('Error updating match status to canceled:', err);
      }
      return createErrorResponse('Match has timed out', 400);
    }
    
    const allPlayers = existingMatch.players || [];
    
    // Если winners не переданы, генерируем случайных победителей
    if (!winners || !validateWinners(winners)) {
      console.log(`[X10 Complete] Генерируем случайных победителей для матча ${matchId}`);
      
      // Убедимся, что у нас достаточно игроков
      if (allPlayers.length < 3) {
        return createErrorResponse('Not enough players to determine winners', 400);
      }
      
      // Перемешиваем игроков для случайного выбора
      const shuffledPlayers = [...allPlayers].sort(() => 0.5 - Math.random());
      
      // Выбираем 3 победителей
      const validPrizes = [X10_CONFIG.PRIZES.FIRST, X10_CONFIG.PRIZES.SECOND, X10_CONFIG.PRIZES.THIRD];
      const validPositions = [1, 2, 3];
      
      winners = shuffledPlayers.slice(0, 3).map((player, index) => ({
        telegramId: player.telegramId,
        username: player.username,
        prize: validPrizes[index],
        position: validPositions[index]
      }));
    } else {
      // Проверяем что победители из списка игроков
      const winnerIds = winners.map((w: X10Winner) => w.telegramId);
      const playerIds = allPlayers.map((p: X10Player) => p.telegramId);
      
      if (!winnerIds.every((id: number) => playerIds.includes(id))) {
        return createErrorResponse('Winners must be from match players', 400);
      }
    }
    
    // Получаем проигравших
    const losers = allPlayers.filter((player: X10Player) => 
      !winners.some((winner: X10Winner) => winner.telegramId === player.telegramId)
    );
    
    const now = new Date();
    
    // ШАГ 2: Обновляем статус матча (отдельно от других операций)
    console.log(`[X10 Complete] Обновляем статус матча ${matchId} на 'completed'`);
    
    try {
      const fullWinners = [
        ...winners.map((winner: X10Winner) => ({
          telegramId: winner.telegramId,
          username: winner.username,
          prize: winner.prize,
          position: winner.position
        })),
        ...losers.map((loser: X10Player) => ({
          telegramId: loser.telegramId,
          username: loser.username,
          prize: 1, // Утешительный приз в виде билета
          position: 0
        }))
      ];
      
      const updateResult = await MatchX10.updateOne(
        { matchId, status: 'playing' },
        {
          $set: {
            status: 'completed',
            completedAt: now.toISOString(),
            winners: fullWinners
          }
        },
        { maxTimeMS: 5000 }
      );
      
      if (updateResult.matchedCount === 0) {
        return createErrorResponse('Match not found or already completed', 404);
      }
    } catch (error) {
      console.error('Error updating match status:', error);
      return createErrorResponse('Error updating match status', 500);
    }
    
    // ШАГ 3: Обновляем балансы (с подтверждением)
    console.log(`[X10 Complete] Обновляем балансы игроков для матча ${matchId}`);

    try {
      // Обновляем балансы победителей (TONOT)
      const winnerUpdates = winners.map(async (winner: X10Winner) => {
        console.log(`[X10 Complete] Обновляем баланс победителя:`, {
          telegramId: winner.telegramId,
          prize: winner.prize,
          position: winner.position
        });

        const updateResult = await User.findOneAndUpdate(
          { telegramId: winner.telegramId },
          { 
            $inc: { 
              'balance': winner.prize,
              'tonotWon': winner.prize
            }
          },
          { new: true }
        );
        
        // Обновляем статус реферала для победителя
        await ReferralService.updateGameStatus(winner.telegramId, 'B');
        
        if (!updateResult) {
          throw new Error(`Failed to update winner balance: ${winner.telegramId}`);
        }
        
        console.log(`[X10 Complete] ✅ Обновлен баланс победителя:`, {
          telegramId: winner.telegramId,
          prize: winner.prize,
          newBalance: updateResult.balance
        });
        return updateResult;
      });

      // Обновляем балансы проигравших (tonotChance)
      const loserUpdates = losers.map(async (loser: X10Player) => {
        console.log(`[X10 Complete] Обновляем баланс проигравшего:`, {
          telegramId: loser.telegramId
        });

        const updateResult = await User.findOneAndUpdate(
          { telegramId: loser.telegramId },
          { 
            $inc: { 
              'tonotChanceTickets': 1,
              'consolationTickets': 1
            }
          },
          { new: true }
        );
        
        // Обновляем статус реферала для проигравшего
        await ReferralService.updateGameStatus(loser.telegramId, 'B');
        
        if (!updateResult) {
          throw new Error(`Failed to update loser balance: ${loser.telegramId}`);
        }
        
        console.log(`[X10 Complete] ✅ Обновлен баланс проигравшего:`, {
          telegramId: loser.telegramId,
          newBalance: updateResult.balance,
          tonotChanceTickets: updateResult.tonotChanceTickets
        });
        return updateResult;
      });

      // Ждем завершения всех обновлений
      const [winnerResults, loserResults] = await Promise.all([
        Promise.all(winnerUpdates),
        Promise.all(loserUpdates)
      ]);

      console.log(`[X10 Complete] ✅ Все балансы успешно обновлены:`, {
        winners: winnerResults.map(w => ({
          telegramId: w.telegramId,
          balance: w.balance,
          tonotWon: w.tonotWon
        })),
        losers: loserResults.map(l => ({
          telegramId: l.telegramId,
          tonotChanceTickets: l.tonotChanceTickets
        }))
      });
      
      // Добавляем записи в историю
      const { db } = await connectToDatabase();
      
      // Определяем призы для каждой позиции
      const PRIZES = {
        1: 450, // Первое место
        2: 270, // Второе место
        3: 180  // Третье место
      };
      
      const historyDocs = [
        // История для победителей (топ-3)
        ...winners.map((winner: X10Winner) => ({
          telegramId: winner.telegramId,
          type: 'game_x10',
          date: now,
          details: {
            matchId,
            result: 'win',
            place: winner.position,
            prize: PRIZES[winner.position as keyof typeof PRIZES],
            totalPlayers: allPlayers.length,
            balanceAfter: winnerResults.find(w => w.telegramId === winner.telegramId)?.balance
          }
        })),
        // История для проигравших (все кто не в топ-3)
        ...losers.map((loser: X10Player) => ({
          telegramId: loser.telegramId,
          type: 'game_x10',
          date: now,
          details: {
            matchId,
            result: 'lose',
            prize: 0,
            tonotChanceTicket: 1, // Получают 1 билет TonotChance
            totalPlayers: allPlayers.length,
            balanceAfter: loserResults.find(l => l.telegramId === loser.telegramId)?.tonotChanceTickets
          }
        }))
      ];

      await db.collection('userHistory').insertMany(historyDocs);
      console.log(`[X10 Complete] ✅ Добавлено ${historyDocs.length} записей в историю для матча ${matchId}`);

    } catch (error) {
      console.error('[X10 Complete] ❌ Ошибка при обновлении балансов или истории:', error);
      return createErrorResponse('Failed to update balances', 500);
    }
    
    // ШАГ 4: Возвращаем результаты
    console.log(`[X10 Complete] ✅ Возвращаем результаты матча ${matchId}`);
    return createSuccessResponse({
      matchId,
      status: 'completed',
      completedAt: now.toISOString(),
      winners: winners.map((w: X10Winner) => ({
        telegramId: w.telegramId,
        username: w.username,
        prize: w.prize,
        position: w.position
      }))
    });
  } catch (error) {
    console.error('Error completing X10 match:', error);
    return createErrorResponse('Internal server error', 500);
  }
} 