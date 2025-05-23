// Типы для API-ответов X10 режима
import { X10_CONFIG } from '@/lib/config';
import type { X10Match } from '@/@types/x10';
import { MAX_PLAYERS } from '@/lib/config';

// Типы для статуса матча
export type X10MatchStatus = 'waiting' | 'matched' | 'completed' | 'canceled';

// Интерфейс баланса билетов
export interface X10TicketBalance {
  tickets: number;
  tonotChanceTickets: number;
  chance: number;
}

// Базовый интерфейс для игрока X10
export interface X10PlayerData {
  telegramId: number;
  username: string;
  balance?: X10TicketBalance;
}

// Интерфейс для победителя
export interface X10WinnerData extends X10PlayerData {
  prize: number;      // 450/270/180
  position: 1 | 2 | 3;
}

// Ответ API для получения статуса игрока
export interface X10GetPlayerStatusResponse {
  success: boolean;
  status?: 'waiting' | 'matched' | 'available';
  isWaiting?: boolean;
  matchId?: string;
  players?: X10PlayerData[];
  balance: X10TicketBalance;
  createdAt?: Date;
  error?: string;
}

// Ответ API для создания/поиска игры
export interface X10CreateGameResponse {
  success: boolean;
  status?: 'waiting' | 'matched';
  message?: string;
  matchId?: string;
  players?: X10PlayerData[];
  balance: X10TicketBalance;
  createdAt?: Date;
  error?: string;
}

// Запрос на создание матча
export interface X10CreateMatchRequest {
  telegramId: number;
  username: string;
}

// Запрос на присоединение к матчу
export interface X10JoinMatchRequest {
  telegramId: number;
  username: string;
  matchId: string;
}

// Запрос на завершение матча
export interface X10CompleteMatchRequest {
  matchId: string;
  winners: X10WinnerData[];
  balanceFields: {
    tickets: string;
    tonotChanceTickets: string;
  };
}

// Данные матча
export interface X10MatchData {
  _id: string;
  matchId: string;
  players: X10PlayerData[];
  status: X10MatchStatus;
  winners?: X10WinnerData[];
  createdAt: Date;
  completedAt?: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

// Данные ожидающего игрока
export interface X10WaitingPlayerData {
  _id: string;
  telegramId: number;
  username: string;
  balance: X10TicketBalance;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Тип для ответа API состояния игры
 */
export interface GameResponse {
  maxPlayers: number;
  status: 'idle' | 'in_match';
  match: X10Match | null;
  prizes?: {
    first: number;
    second: number;
    third: number;
  };
  canPlay?: boolean;
  balance?: X10TicketBalance;
}

/**
 * Проверяет готовность матча к началу
 */
export function isMatchReady(playersCount: number): boolean {
  return playersCount === X10_CONFIG.MATCH.MAX_PLAYERS;
}

// Базовые утилиты для проверок
export const x10ModelUtils = {
  /**
   * Проверяет корректность призов победителей
   */
  validateWinners: (winners: X10WinnerData[]): boolean => {
    if (winners.length !== 3) return false;

    const prizes = [450, 270, 180];

    return winners.every((winner, index) => 
      winner.prize === prizes[index] && 
      winner.position === (index + 1)
    );
  },

  /**
   * Проверяет достаточность билетов для игры
   */
  hasEnoughTickets: (balance: X10TicketBalance): boolean => {
    return balance.chance >= X10_CONFIG.TICKETS.GAME.COST;
  }
}; 