import { Socket, Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/@types/x10Socket';
import User from '@/models/User';
import MatchX10 from '@/models/MatchX10';
const WaitingPlayerX10 = require('@/models/WaitingPlayerX10');
import { generateMatchId } from '@/utils/x10Utils';
import { X10Player, X10Match } from '@/@types/x10';
import { X10_CONFIG } from '@/lib/config';

// Set для хранения активных соединений x10
export const activeX10Connections = new Set<Socket>();

// Конфигурация анимации из общего конфига
export const ANIMATION_CONFIG = {
  PREPARING: X10_CONFIG.GAME_TIMINGS.PREPARING,       // 5 секунд countdown
  MERGING: X10_CONFIG.GAME_TIMINGS.MERGING,          // 7.5 секунд анимация
  WHEEL_APPEAR: X10_CONFIG.GAME_TIMINGS.WHEEL_APPEAR, // 4 секунды
  WHEEL_SPIN: X10_CONFIG.GAME_TIMINGS.WHEEL_SPIN,    // 7 секунд
  WHEEL_STOP: X10_CONFIG.GAME_TIMINGS.WHEEL_STOP,    // 2 секунды
  RESULT: X10_CONFIG.GAME_TIMINGS.RESULT             // 1 секунда
} as const;

// Конфигурация для x10 режима из общего конфига
export const HANDLER_CONFIG = {
  waitingTimeout: X10_CONFIG.MATCH.QUEUE_TIMEOUT,
  matchTimeout: X10_CONFIG.MATCH.TIMEOUT,
  countdownTime: X10_CONFIG.COUNTDOWN_TIME,
  minPlayers: X10_CONFIG.MATCH.MIN_PLAYERS,
  maxPlayers: X10_CONFIG.MATCH.MAX_PLAYERS,
  ticketCost: X10_CONFIG.TICKETS.GAME.COST,
  prizes: {
    FIRST: X10_CONFIG.PRIZES.FIRST,
    SECOND: X10_CONFIG.PRIZES.SECOND,
    THIRD: X10_CONFIG.PRIZES.THIRD
  }
} as const;

// Храним ссылку на io для broadcast
let io: Server;
export const setIO = (ioServer: Server) => {
  io = ioServer;
};

// Общая функция для обработки призов
async function handlePrizeDistribution(winners: Array<{ telegramId: number; prize: number }>, socket: Socket) {
  for (const winner of winners) {
    try {
      const user = await User.findOne({ telegramId: winner.telegramId });
      if (user) {
        // Обновляем только баланс билетов
        user.balance.tickets += winner.prize;
        await user.save();
        
        // Отправляем только информацию о выигрыше
        socket.emit('x10_game_result', {
          telegramId: winner.telegramId,
          prize: winner.prize
        });
      }
    } catch (error) {
      console.error(`[X10] Ошибка при обновлении баланса игрока ${winner.telegramId}:`, error);
    }
  }
}

/**
 * Очистка "зависших" матчей
 */
export async function cleanupStalledMatchesX10() {
  try {
    const now = new Date();
    const matchTimeout = new Date(now.getTime() - HANDLER_CONFIG.matchTimeout);
    const waitingTimeout = new Date(now.getTime() - HANDLER_CONFIG.waitingTimeout);
    
    // Отменяем только матчи в статусе playing, которые "зависли"
    const stalledMatches = await MatchX10.updateMany(
      { 
        status: 'playing',
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
    
    // Для ожидающих игроков проверяем только очень старые записи
    const deletedPlayers = await WaitingPlayerX10.deleteMany({
      timestamp: { $lt: waitingTimeout }
    });
    
    if (stalledMatches.modifiedCount > 0 || deletedPlayers.deletedCount > 0) {
      console.log(`[X10] Очистка: отменено ${stalledMatches.modifiedCount} зависших матчей, удалено ${deletedPlayers.deletedCount} устаревших записей (>12 часов)`);
    }
  } catch (error) {
    console.error('[X10] Ошибка при очистке "зависших" матчей:', error);
  }
}

/**
 * Основной обработчик подключения для X10
 */
export function handleX10Connection(socket: Socket) {
  console.log('[X10Socket] New connection:', {
    socketId: socket.id,
    query: socket.handshake.query
  });
  
  const telegramId = socket.handshake.query.telegramId 
    ? parseInt(socket.handshake.query.telegramId as string, 10) 
    : undefined;

  if (!telegramId) {
    console.error('[X10Socket] No telegramId in query');
    socket.disconnect();
    return;
  }

  socket.data.telegramId = telegramId;
  activeX10Connections.add(socket);

  // Добавляем обработчики heartbeat
  socket.on('heartbeat', () => {
    socket.emit('heartbeat_ack');
    console.log('[X10Socket] 💓 Heartbeat от клиента:', socket.id);
  });

  socket.on('heartbeat_ack', () => {
    console.log('[X10Socket] ✅ Heartbeat подтвержден от клиента:', socket.id);
  });

  // Подключение к комнате для синхронизации
  socket.on('joinX10Room', async (data: { matchId: string }, callback) => {
    try {
      const roomName = `x10:${data.matchId}`;
      socket.join(roomName);
      callback({ success: true });
    } catch (error) {
      console.error('[X10Socket] Error joining room:', error);
      callback({ success: false, error: 'Failed to join room' });
    }
  });

  socket.on('disconnect', () => {
    activeX10Connections.delete(socket);
    console.log('[X10Socket] Client disconnected:', socket.id);
  });
}

/**
 * Отправка события начала игры всем участникам
 */
export const broadcastGameStart = async (match: X10Match) => {
  try {
    if (!io) {
      throw new Error('Socket.IO not initialized');
    }

    const roomName = `x10:${match.matchId}`;
    console.log(`[X10Socket] Broadcasting game start to room ${roomName}`);
    
    // Отправляем событие начала игры
    io.to(roomName).emit('gameStarted', {
      matchId: match.matchId,
      startTime: match.startedAt || new Date(),
      players: match.players
    });

    console.log(`[X10Socket] Game start broadcasted for match ${match.matchId}`, {
      matchId: match.matchId,
      playersCount: match.players.length
    });

    // Запускаем первую фазу игры
    setTimeout(() => {
      console.log(`[X10Socket] Starting preparing phase for match ${match.matchId}`);
      io.to(roomName).emit('gamePhase', {
        matchId: match.matchId,
        phase: 'preparing',
        players: match.players
      });
    }, 1000);

  } catch (error) {
    console.error('[X10Socket] Broadcast error:', error);
  }
};

// Обновляем тип для addPlayerToMatch
interface X10PlayerData {
  telegramId: number;
  username: string;
  createdAt: string;
  chance: 1;
}

export const addPlayerToMatch = async (match: { 
  players: X10PlayerData[];
  save: () => Promise<any>;
}, player: { telegramId: number; username: string }) => {
  const existingPlayer = match.players.find((p: X10PlayerData) => p.telegramId === player.telegramId);
  if (existingPlayer) return match;

  const newPlayer = {
    ...player,
    createdAt: new Date().toISOString(),
    chance: 1 as const
  };

  match.players.push(newPlayer);
  await match.save();
  return match;
};

async function removePlayerFromMatch(matchId: string, telegramId: number) {
  const match = await MatchX10.findOne({ matchId });
  if (!match) return false;

  const playerIndex = match.players.findIndex((p: X10Player) => p.telegramId === telegramId);
  if (playerIndex === -1) return false;

  match.players.splice(playerIndex, 1);
  match.currentPlayers--;
  await match.save();

  return true;
} 