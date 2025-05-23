/**
 * Типы для X10 режима игры
 */
import { X10_CONFIG } from '@/lib/config';

/**
 * Возможные статусы X10 матча
 * - waiting: ожидание игроков
 * - playing: игра идет
 * - completed: игра завершена
 * - canceled: игра отменена
 */
export type X10MatchStatus = 'waiting' | 'playing' | 'completed' | 'canceled';

/**
 * Игрок в X10 матче
 */
export interface X10Player {
  telegramId: number;    // Telegram ID игрока
  username: string;      // Имя игрока
  createdAt: string;     // Время присоединения
  chance: typeof X10_CONFIG.TICKETS.GAME.COST // Всегда 1 билет для входа
}

/**
 * Победитель в X10 матче
 */
export interface X10Winner {
  telegramId: number;    // Telegram ID победителя
  username: string;      // Имя победителя
  prize: number;         // Размер выигрыша в TONOT или 1 для TonotChance
  position: 0 | 1 | 2 | 3;   // Занятое место (0 для проигравших, 1-3 для победителей)
}

/**
 * Матч в режиме X10
 */
export interface X10Match {
  matchId: string;           // Уникальный ID матча
  players: X10Player[];      // Список игроков (максимум 10)
  status: X10MatchStatus;    // Статус матча
  winners?: X10Winner[];     // Победители (после завершения)
  createdAt: string;        // Время создания
  startedAt?: string;       // Время начала игры
  completedAt?: string;     // Время завершения
  cancelReason?: string;    // Причина отмены
}

/**
 * Общий интерфейс для API запросов
 */
export interface X10ApiRequest {
  telegramId: number;
  username?: string;
  matchId?: string;
}

/**
 * Общий интерфейс для API ответов
 */
export interface X10ApiResponse {
  success: boolean;
  data?: X10Match | null;
  error?: string;
  message?: string;
} 