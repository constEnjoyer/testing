import mongoose from 'mongoose';
const { Schema } = mongoose;
const { X10_CONFIG } = require('../lib/config');

const ONE_HOUR = 60 * 60; // 1 час в секундах

/**
 * Схема ожидающего игрока X10
 * Оптимизирована для быстрого поиска и автоматической очистки
 */
const waitingPlayerX10Schema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  ticketLocked: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + (ONE_HOUR * 1000)),
    index: true
  }
}, { 
  timestamps: true,
  collection: 'waitingPlayersX10'
});

// Составной индекс для быстрого поиска по времени и статусу билета
waitingPlayerX10Schema.index({ joinedAt: 1, ticketLocked: 1 });

// Виртуальные поля
waitingPlayerX10Schema.virtual('timeInQueue').get(function() {
  return Date.now() - this.joinedAt.getTime();
});

waitingPlayerX10Schema.virtual('canRefundTicket').get(function() {
  return this.timeInQueue >= ONE_HOUR * 1000;
});

// Статические методы
waitingPlayerX10Schema.statics = {
  /**
   * Найти всех ожидающих игроков с заблокированными билетами
   */
  findWaitingPlayers: async function() {
    const now = new Date();
    return this.find({
      ticketLocked: true,
      expiresAt: { $gt: now }
    })
    .sort({ joinedAt: 1 })
    .limit(X10_CONFIG.PLAYERS.MAX)
    .lean();
  },

  /**
   * Проверить статус игрока в очереди
   */
  getPlayerStatus: async function(telegramId) {
    const player = await this.findOne({ telegramId }).lean();
    if (!player) return null;

    return {
      timeInQueue: Date.now() - player.joinedAt.getTime(),
      canRefund: Date.now() - player.joinedAt.getTime() >= ONE_HOUR * 1000,
      ticketLocked: player.ticketLocked
    };
  },

  /**
   * Попытка вернуть билет (только после 1 часа)
   */
  tryRefundTicket: async function(telegramId) {
    const player = await this.findOne({ telegramId });
    if (!player) return { success: false, reason: 'player_not_found' };
    if (!player.canRefundTicket) return { success: false, reason: 'too_early' };

    await this.findOneAndDelete({ telegramId });
    return { success: true };
  },

  /**
   * Очистка просроченных записей с возвратом билетов
   */
  cleanupExpired: async function() {
    const now = new Date();
    const expiredPlayers = await this.find({
      expiresAt: { $lte: now },
      ticketLocked: true
    });

    const results = {
      expired: expiredPlayers.length,
      refunded: 0
    };

    for (const player of expiredPlayers) {
      const refundResult = await this.tryRefundTicket(player.telegramId);
      if (refundResult.success) results.refunded++;
    }

    return results;
  },

  /**
   * Найти и заблокировать билеты для матча
   */
  findAndLockForMatch: async function() {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const players = await this.find({
        ticketLocked: true,
        expiresAt: { $gt: new Date() }
      })
      .sort({ joinedAt: 1 })
      .limit(X10_CONFIG.PLAYERS.MAX)
      .session(session);

      if (players.length === X10_CONFIG.PLAYERS.MAX) {
        await this.updateMany(
          { telegramId: { $in: players.map(p => p.telegramId) } },
          { ticketLocked: true },
          { session }
        );
        await session.commitTransaction();
        return players;
      }

      await session.abortTransaction();
      return null;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
};

// Создаем и экспортируем модель
const WaitingPlayerX10 = mongoose.models.WaitingPlayerX10 || mongoose.model('WaitingPlayerX10', waitingPlayerX10Schema);

export default WaitingPlayerX10; 