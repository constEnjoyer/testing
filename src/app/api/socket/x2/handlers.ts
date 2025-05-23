import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@/@types/socket';
import User from '@/models/User';
import Match from '@/models/Match';
import WaitingPlayer from '@/models/WaitingPlayer';
import { v4 as uuidv4 } from 'uuid';

// Set для хранения активных соединений
export const activeX2Connections = new Set<Socket<ClientToServerEvents, ServerToClientEvents>>();

// Конфигурация для X2 режима
export const X2_CONFIG = {
  waitingTimeout: 120000,  // 2 минуты в миллисекундах
  matchTimeout: 300000,    // 5 минут в миллисекундах
  countdownTime: 5,        // время обратного отсчета в секундах
  ticketPrice: 1          // стоимость входа в билетах
};

/**
 * Очистка "зависших" матчей и игроков
 */
export async function cleanupStalledMatchesX2() {
  try {
    const now = new Date();
    const matchTimeout = new Date(now.getTime() - X2_CONFIG.matchTimeout);
    const waitingTimeout = new Date(now.getTime() - X2_CONFIG.waitingTimeout);
    
    // Отменяем "зависшие" матчи
    const stalledMatches = await Match.updateMany(
      { 
        status: { $in: ['waiting', 'matched'] },
        createdAt: { $lt: matchTimeout }
      },
      {
        $set: { 
          status: 'canceled',
          cancelReason: 'timeout',
          canceledAt: now
        }
      }
    );
    
    // Удаляем устаревших ожидающих игроков
    const deletedPlayers = await WaitingPlayer.deleteMany({
      timestamp: { $lt: waitingTimeout }
    });
    
    if (stalledMatches.modifiedCount > 0 || deletedPlayers.deletedCount > 0) {
      console.log(`[X2] Очистка: отменено ${stalledMatches.modifiedCount} матчей, удалено ${deletedPlayers.deletedCount} ожидающих игроков`);
    }
  } catch (error) {
    console.error('[X2] Ошибка при очистке "зависших" матчей:', error);
  }
}

/**
 * Основной обработчик подключения для X2
 */
export function handleX2Connection(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
  console.log('[X2Socket] 🔌 Новое подключение:', socket.id);
  
  const telegramId = socket.handshake.query.telegramId 
    ? parseInt(socket.handshake.query.telegramId as string, 10) 
    : undefined;

  console.log(`[X2] Подключение нового клиента: ${socket.id}, Telegram ID: ${telegramId}`);

  if (!telegramId) {
    socket.emit('error', 'Не указан telegramId');
    socket.disconnect();
    return;
  }

  socket.data.telegramId = telegramId;
  socket.data.joinedAt = new Date();
  activeX2Connections.add(socket);

  // Очищаем старые матчи при подключении
  cleanupStalledMatchesX2();

  // Присоединение к комнате ожидания
  socket.on('join_waiting_room', (data: { telegramId: number; ticketsAmount: number }) => {
    (async () => {
      try {
        const user = await User.findOne({ telegramId: data.telegramId });
        const username = user?.username || 'Игрок';
        console.log(`[X2] Попытка входа игрока ${data.telegramId} (${username})`);

        // Проверяем баланс игрока
        if (!user || user.balance.chance < X2_CONFIG.ticketPrice) {
          socket.emit('error', 'У вас недостаточно билетов');
          return;
        }

        // Проверяем, не находится ли игрок уже в матче
        const existingMatch = await Match.findOne({
          $or: [
            { player1Id: data.telegramId },
            { player2Id: data.telegramId }
          ],
          status: { $in: ['waiting', 'matched'] }
        });

        if (existingMatch) {
          socket.emit('error', 'Вы уже находитесь в матче');
          return;
        }

        // Ищем другого игрока в очереди
        const waitingOpponent = await WaitingPlayer.findOne({ 
          telegramId: { $ne: data.telegramId } 
        }).sort({ timestamp: 1 });

        if (waitingOpponent) {
          // Если нашелся оппонент, создаем матч
          const matchId = uuidv4();
          const match = new Match({
            matchId,
            player1Id: data.telegramId,
            player1Name: username,
            player2Id: waitingOpponent.telegramId,
            player2Name: waitingOpponent.username || 'Игрок',
            ticketsAmount: X2_CONFIG.ticketPrice,
            status: 'matched',
            createdAt: new Date()
          });

          await match.save();

          // Удаляем оппонента из очереди
          await WaitingPlayer.deleteOne({ telegramId: waitingOpponent.telegramId });

          // Отправляем данные о матче обоим игрокам
          const matchData = {
            matchId,
            player1Id: data.telegramId,
            player1Name: username,
            player2Id: waitingOpponent.telegramId,
            player2Name: waitingOpponent.username || 'Игрок',
            ticketsAmount: X2_CONFIG.ticketPrice,
            createdAt: match.createdAt
          };

          socket.emit('opponent_found', matchData);

          // Отправляем оппоненту
          const opponentSocket = Array.from(activeX2Connections).find(
            s => s.data.telegramId === waitingOpponent.telegramId
          );
          if (opponentSocket) {
            opponentSocket.emit('opponent_found', matchData);
          }
        } else {
          // Если нет оппонента, добавляем в очередь
          const waitingPlayer = new WaitingPlayer({
            telegramId: data.telegramId,
            username: username,
            timestamp: new Date()
          });
          await waitingPlayer.save();
        }

      } catch (error) {
        console.error('[X2] Ошибка при входе в комнату:', error);
        socket.emit('error', 'Ошибка при входе в комнату');
      }
    })();
  });

  // Отмена ожидания
  socket.on('cancel_waiting', (telegramId: number) => {
    (async () => {
      try {
        console.log(`[X2] Отмена ожидания для игрока ${telegramId}`);
        await WaitingPlayer.deleteOne({ telegramId });
        socket.emit('game_canceled', 'Поиск игры отменен');
      } catch (error) {
        console.error('[X2] Ошибка при отмене ожидания:', error);
        socket.emit('error', 'Ошибка при отмене ожидания');
      }
    })();
  });

  // Завершение игры
  socket.on('complete_game', async (data: { 
    matchId: string;
    winnerId: number | null;
    player1Id: number;
    player2Id: number;
    ticketsAmount: number;
  }) => {
    try {
      console.log(`[X2] Завершение игры ${data.matchId}, победитель: ${data.winnerId}`);

      const match = await Match.findOne({ matchId: data.matchId });
      if (!match) {
        socket.emit('error', 'Матч не найден');
        return;
      }

      // Проверяем, не завершен ли уже матч
      if (match.status === 'completed') {
        console.log(`[X2] Матч ${data.matchId} уже завершен`);
        socket.emit('error', 'Матч уже завершен');
        return;
      }

      // Проверяем, что победитель является одним из участников матча
      if (data.winnerId && data.winnerId !== match.player1Id && data.winnerId !== match.player2Id) {
        console.log(`[X2] Некорректный победитель ${data.winnerId} для матча ${data.matchId}`);
        socket.emit('error', 'Некорректный победитель');
        return;
      }

      // Обновляем матч
      match.status = 'completed';
      match.winnerId = data.winnerId;
      match.completedAt = new Date();
      await match.save();

      // Обновляем баланс победителя
      if (data.winnerId) {
        const winner = await User.findOne({ telegramId: data.winnerId });
        if (winner) {
          winner.balance.chance += data.ticketsAmount * 2;
          await winner.save();
        }
      }

      // Отправляем результаты обоим игрокам
      const gameResult = {
        matchId: data.matchId,
        winnerId: data.winnerId,
        ticketsAmount: data.ticketsAmount,
        isWinner: false
      };

      // Отправляем первому игроку
      const player1Socket = Array.from(activeX2Connections).find(
        s => s.data.telegramId === data.player1Id
      );
      if (player1Socket) {
        player1Socket.emit('game_completed', {
          ...gameResult,
          isWinner: data.winnerId === data.player1Id
        });
      }

      // Отправляем второму игроку
      const player2Socket = Array.from(activeX2Connections).find(
        s => s.data.telegramId === data.player2Id
      );
      if (player2Socket) {
        player2Socket.emit('game_completed', {
          ...gameResult,
          isWinner: data.winnerId === data.player2Id
        });
      }

    } catch (error) {
      console.error('[X2] Ошибка при завершении игры:', error);
      socket.emit('error', 'Ошибка при завершении игры');
    }
  });

  // Отключение
  socket.on('disconnect', async () => {
    try {
      console.log('[X2] Отключение:', socket.id);
      activeX2Connections.delete(socket);

      if (telegramId) {
        // Удаляем из очереди при отключении
        await WaitingPlayer.deleteOne({ telegramId });
      }
    } catch (error) {
      console.error('[X2] Ошибка при отключении:', error);
    }
  });
} 