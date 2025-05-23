import mongoose from 'mongoose';
import { X10_CONFIG } from '@/lib/config';
import { generateMatchId } from '../utils/x10Utils';

/**
 * Схема для матча в режиме X10
 * @typedef {Object} MatchX10
 * @property {string} matchId - Уникальный идентификатор матча
 * @property {Array<X10Player>} players - Массив игроков
 * @property {number} currentPlayers - Текущее количество игроков
 * @property {string} status - Статус матча (waiting, playing, completed, canceled)
 * @property {Date} createdAt - Дата создания матча
 * @property {Date} startedAt - Дата начала матча
 * @property {Date} completedAt - Дата завершения матча
 * @property {Date} timeoutAt - Дата истечения времени ожидания
 * @property {Array<X10Winner>} winners - Массив победителей (только для completed)
 */

/**
 * @typedef {Object} MatchX10Response
 * @property {boolean} success
 * @property {string} [message]
 * @property {Object} [match]
 * @property {string} [error]
 */

/**
 * @typedef {Object} MatchX10Event
 * @property {string} type
 * @property {Object} payload
 * @property {string} payload.matchId
 * @property {number} [payload.telegramId]
 * @property {number} [payload.position]
 * @property {string} [payload.status]
 * @property {string} [payload.error]
 */

const matchX10Schema = new mongoose.Schema({
  matchId: { 
    type: String,
    required: true,
    unique: true,
    index: true,
    default: generateMatchId
  },
  players: [{
    telegramId: { type: Number, required: true },
    username: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    chance: { 
      type: Number, 
      default: X10_CONFIG.TICKETS.GAME.COST,
      validate: {
        validator: function(v) {
          return v === X10_CONFIG.TICKETS.GAME.COST;
        },
        message: 'Для входа требуется 1 билет'
      }
    },
    isReady: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['waiting', 'playing', 'completed', 'canceled'],
    default: 'waiting',
    index: true
  },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
  cancelReason: String,
  winners: [{
    telegramId: Number,
    username: String,
    prize: Number,
    position: {
      type: Number,
      min: 1,
      max: 3,
      required: true
    }
  }],
  timeoutAt: {
    type: Date,
    default: () => new Date(Date.now() + X10_CONFIG.MATCH.TIMEOUT),
    index: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      if (ret.createdAt) ret.createdAt = ret.createdAt.toISOString();
      if (ret.startedAt) ret.startedAt = ret.startedAt.toISOString();
      if (ret.completedAt) ret.completedAt = ret.completedAt.toISOString();
      if (ret.timeoutAt) ret.timeoutAt = ret.timeoutAt.toISOString();
      if (ret.players) {
        ret.players = ret.players.map(player => ({
          ...player,
          createdAt: player.createdAt.toISOString()
        }));
      }
      return ret;
    }
  }
});

// Составные индексы
matchX10Schema.index({ status: 1, createdAt: 1 });
matchX10Schema.index({ 'players.telegramId': 1, status: 1 });
matchX10Schema.index({ status: 1, timeoutAt: 1 });

// Виртуальные поля
matchX10Schema.virtual('isFull').get(function() {
  return this.players.length >= X10_CONFIG.PLAYERS.MAX;
});

matchX10Schema.virtual('canJoin').get(function() {
  return this.status === 'waiting' && !this.isFull;
});

matchX10Schema.virtual('isExpired').get(function() {
  return this.timeoutAt && this.timeoutAt < new Date();
});

matchX10Schema.virtual('readyPlayersCount').get(function() {
  return this.players.filter(p => p.isReady).length;
});

matchX10Schema.virtual('canStart').get(function() {
  return this.isFull && this.readyPlayersCount === X10_CONFIG.PLAYERS.MAX;
});

// Методы экземпляра
matchX10Schema.methods = {
  addPlayer: async function(telegramId, username) {
    if (this.isFull) {
      throw new Error('Матч полон');
    }
    if (this.status !== 'waiting') {
      throw new Error('Матч недоступен для присоединения');
    }
    if (this.isExpired) {
      throw new Error('Время ожидания матча истекло');
    }
    if (this.players.some(p => p.telegramId === telegramId)) {
      throw new Error('Игрок уже в матче');
    }

    this.players.push({
      telegramId,
      username,
      createdAt: new Date(),
      chance: X10_CONFIG.TICKETS.GAME.COST,
      isReady: false
    });
    
    return this.save();
  },

  setPlayerReady: async function(telegramId) {
    const player = this.players.find(p => p.telegramId === telegramId);
    if (!player) {
      throw new Error('Игрок не найден в матче');
    }
    if (this.status !== 'waiting') {
      throw new Error('Матч уже начался или завершен');
    }
    
    player.isReady = true;
    
    if (this.canStart) {
      this.status = 'playing';
      this.startedAt = new Date();
    }
    
    return this.save();
  },

  complete: async function(winners) {
    if (this.status !== 'playing') {
      throw new Error('Матч не находится в процессе игры');
    }

    if (!Array.isArray(winners) || winners.length !== 3) {
      throw new Error('Требуется ровно 3 победителя');
    }

    const positions = new Set(winners.map(w => w.position));
    if (positions.size !== 3) {
      throw new Error('Позиции победителей должны быть уникальными (1, 2, 3)');
    }

    this.status = 'completed';
    this.completedAt = new Date();
    this.winners = winners;
    return this.save();
  },

  cancel: async function(reason) {
    if (['completed', 'canceled'].includes(this.status)) {
      throw new Error('Матч уже завершен или отменен');
    }

    this.status = 'canceled';
    this.cancelReason = reason;
    this.completedAt = new Date();
    return this.save();
  }
};

// Статические методы
matchX10Schema.statics = {
  /**
   * Найти активный матч игрока
   * @param {number} telegramId ID игрока в Telegram
   * @returns {Promise<MatchX10|null>} Активный матч или null
   */
  findPlayerActiveMatch: async function(telegramId) {
    return this.findOne({
      'players.telegramId': telegramId,
      status: { $in: ['waiting', 'playing'] }
    }).lean();
  },

  /**
   * Найти доступный матч для присоединения
   * @returns {Promise<MatchX10|null>} Доступный матч или null
   */
  findAvailableMatch: async function() {
    const now = new Date();
    return this.findOne({
      status: 'waiting',
      'players.9': { $exists: false },
      timeoutAt: { $gt: now }
    }).sort({ createdAt: 1 });
  },

  /**
   * Создать новый матч
   * @param {number} telegramId ID игрока в Telegram
   * @param {string} username Имя игрока
   * @returns {Promise<MatchX10>} Созданный матч
   */
  createMatch: async function(telegramId, username) {
    const match = new this({
      players: [{
        telegramId,
        username,
        createdAt: new Date(),
        chance: X10_CONFIG.TICKETS.GAME.COST,
        isReady: false
      }],
      status: 'waiting',
      timeoutAt: new Date(Date.now() + X10_CONFIG.MATCH.TIMEOUT)
    });
    await match.save();
    return match;
  },

  /**
   * Очистить просроченные матчи
   * @returns {Promise<Object>} Результат очистки
   */
  cleanupExpiredMatches: async function() {
    const now = new Date();
    const result = await this.updateMany(
      {
        status: 'waiting',
        timeoutAt: { $lte: now }
      },
      {
        $set: {
          status: 'canceled',
          cancelReason: 'Время ожидания истекло',
          completedAt: now
        }
      }
    );
    return result;
  }
};

// События WebSocket
export const MatchX10Events = {
  JOIN: 'x10:join',
  LEAVE: 'x10:leave',
  READY: 'x10:ready',
  START: 'x10:start',
  COMPLETE: 'x10:complete',
  CANCEL: 'x10:cancel',
  UPDATE: 'x10:update',
  ERROR: 'x10:error'
};

const MatchX10 = mongoose.models.MatchX10 || mongoose.model('MatchX10', matchX10Schema);

export default MatchX10; 