// Типы для API-ответов

// Типы для статуса матча
export type MatchStatus = 'waiting' | 'matched' | 'completed' | 'canceled';

// Ответ API для получения статуса игрока
export interface GetPlayerStatusResponse {
  success: boolean;
  status?: 'waiting' | 'matched' | 'available';
  isWaiting?: boolean;
  matchId?: string;
  player1Id?: number;
  player1Name?: string;
  player2Id?: number;
  player2Name?: string;
  ticketsAmount?: number;
  createdAt?: Date;
  error?: string;
}

// Ответ API для создания/поиска игры
export interface CreateGameResponse {
  success: boolean;
  status?: 'waiting' | 'matched';
  message?: string;
  matchId?: string;
  player1Id?: number;
  player1Name?: string;
  player2Id?: number;
  player2Name?: string;
  ticketsAmount?: number;
  createdAt?: Date;
  error?: string;
}

// Данные матча
export interface MatchData {
  _id: string;
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  ticketsAmount: number;
  status: MatchStatus;
  winnerId?: number;
  createdAt: Date;
  completedAt?: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

// Данные ожидающего игрока
export interface WaitingPlayerData {
  _id: string;
  telegramId: number;
  username: string;
  createdAt: Date;
} 