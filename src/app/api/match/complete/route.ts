import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';
import Match from '@/models/Match';
import User from '@/models/User';
import { ReferralService } from '@/lib/referral';
import { ObjectId } from 'mongodb';
import { Server } from 'socket.io';

declare global {
  var io: Server;
}

// Добавляем флаг для принудительного динамического рендеринга
export const dynamic = 'force-dynamic';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * POST-обработчик для завершения матча
 * @param request - Запрос с данными завершения матча
 * @returns {Promise<NextResponse>} - Ответ с данными завершенного матча или ошибкой
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Подключаемся к БД
    await connectToDatabase();
    
    // Получаем данные из запроса
    const data = await request.json();
    const { matchId } = data;
    
    if (!matchId) {
      console.error('[API match/complete] Отсутствует matchId:', { matchId });
      return NextResponse.json(
        { success: false, error: 'Требуется matchId' },
        { status: 400 }
      );
    }
    
    console.log('[API match/complete] Завершение матча:', { matchId });
    
    // Функция для выполнения транзакции с повторными попытками
    const executeWithRetry = async (attempt = 1) => {
      const session = await mongoose.startSession();
      
      try {
        session.startTransaction();

        // Найдем матч
        const match = await Match.findOne({ matchId }).session(session);
        
        if (!match) {
          await session.abortTransaction();
          return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
        }
        
        // Проверяем, не завершен ли уже матч
        if (match.status === 'completed') {
          console.warn('[API match/complete] Матч уже завершен:', matchId);
          // Возвращаем текущие данные без повторного начисления наград
          const existingWinner = await User.findOne({ telegramId: match.winnerId });
          const existingLoser = await User.findOne({ 
            telegramId: match.player1Id === match.winnerId ? match.player2Id : match.player1Id 
          });

          return NextResponse.json({ 
            success: true, 
            data: { 
              matchId: match.matchId,
              winnerId: match.winnerId,
              status: match.status,
              winner: existingWinner ? {
                telegramId: existingWinner.telegramId,
                balance: existingWinner.balance,
                tickets: existingWinner.tickets,
                tonotChanceTickets: existingWinner.tonotChanceTickets
              } : null,
              loser: existingLoser ? {
                telegramId: existingLoser.telegramId,
                balance: existingLoser.balance,
                tickets: existingLoser.tickets,
                tonotChanceTickets: existingLoser.tonotChanceTickets
              } : null
            },
            message: 'Матч уже завершен, награды уже начислены'
          });
        }
        
        // Определяем победителя случайным образом на сервере
        const winnerId = Math.random() < 0.5 ? match.player1Id : match.player2Id;
        
        // Обновляем статус матча
        match.status = 'completed';
        match.winnerId = winnerId;
        match.completedAt = new Date();
        await match.save({ session });
        
        // Определяем ID проигравшего
        const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
        
        // Проверяем и обновляем данные игроков
        const [winner, loser] = await Promise.all([
          User.findOne({ telegramId: winnerId }).session(session),
          User.findOne({ telegramId: loserId }).session(session)
        ]);
        
        if (!winner || !loser) {
          await session.abortTransaction();
          console.error('[API match/complete] Не найден один из игроков:', { winnerId, loserId });
          return NextResponse.json(
            { success: false, error: 'Один или оба игрока не найдены' },
            { status: 404 }
          );
        }
        
        // Проверяем, что это действительно разные игроки
        if (winner.telegramId === loser.telegramId) {
          await session.abortTransaction();
          console.error('[API match/complete] Попытка установить одного игрока как победителя и проигравшего:', winner.telegramId);
          return NextResponse.json(
            { success: false, error: 'Победитель и проигравший не могут быть одним игроком' },
            { status: 400 }
          );
        }
        
        // Обновляем баланс победителя
        winner.balance += 180;
        winner.tonotWon = (winner.tonotWon || 0) + 180;
        await winner.save({ session });
        
        // Обновляем только билеты проигравшего
        loser.tonotChanceTickets = (loser.tonotChanceTickets || 0) + 1;
        await loser.save({ session });
        
        // Обновляем статусы рефералов
        await Promise.all([
          ReferralService.updateGameStatus(winner.telegramId, 'A'),
          ReferralService.updateGameStatus(loser.telegramId, 'A')
        ]);
        
        // Записываем историю
        const userHistoryCollection = mongoose.connection.collection('userHistory');
        await Promise.all([
          userHistoryCollection.insertOne({
            telegramId: winner.telegramId,
            type: 'game',
            date: new Date(),
            details: {
              matchId: match.matchId,
              opponentId: loserId,
              opponentName: loser ? `${loser.firstName} ${loser.lastName || ''}`.trim() : 'Неизвестный игрок',
              result: 'win',
              tonotReward: 180
            }
          }, { session }),
          userHistoryCollection.insertOne({
            telegramId: loser.telegramId,
            type: 'game',
            date: new Date(),
            details: {
              matchId: match.matchId,
              opponentId: winnerId,
              opponentName: winner ? `${winner.firstName} ${winner.lastName || ''}`.trim() : 'Неизвестный игрок',
              result: 'lose',
              tonotChanceTickets: 1
            }
          }, { session })
        ]);
        
        // Фиксируем транзакцию
        await session.commitTransaction();
        
        // Готовим ответ
        const response = {
          success: true,
          data: {
            matchId: match.matchId,
            winnerId: match.winnerId,
            status: match.status,
            winner: {
              telegramId: winner.telegramId,
              balance: winner.balance,
              tickets: winner.tickets,
              tonotChanceTickets: winner.tonotChanceTickets
            },
            loser: {
              telegramId: loser.telegramId,
              balance: loser.balance,
              tickets: loser.tickets,
              tonotChanceTickets: loser.tonotChanceTickets
            }
          }
        };
        
        console.log('[API match/complete] Успешное завершение матча:', response);
        
        // Отправляем результат через WebSocket всем участникам
        const io = global.io;
        if (io) {
          console.log('[API match/complete] 📤 Отправка результата победителю:', {
            userId: winnerId,
            isWinner: true,
            matchData: response.data
          });
          
          io.to(`user_${winnerId}`).emit('game_completed', { 
            ...response.data,
            isWinner: true 
          });

          console.log('[API match/complete] 📤 Отправка результата проигравшему:', {
            userId: loserId,
            isWinner: false,
            matchData: response.data
          });
          
          io.to(`user_${loserId}`).emit('game_completed', { 
            ...response.data,
            isWinner: false 
          });
        }

        return NextResponse.json(response);

      } catch (error) {
        await session.abortTransaction();

        // Если это конфликт записи и есть еще попытки, пробуем снова
        if (
          error instanceof mongoose.Error || 
          (error as any).code === 112 && 
          attempt < MAX_RETRIES
        ) {
          console.log(`[API match/complete] Попытка ${attempt} не удалась, повторяем через ${RETRY_DELAY}мс`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return executeWithRetry(attempt + 1);
        }

        throw error;
      } finally {
        session.endSession();
      }
    };

    return executeWithRetry();

  } catch (error) {
    console.error('[API match/complete] Ошибка при завершении матча:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
} 