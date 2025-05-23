/**
 * Утилиты для игровой комнаты X10
 */
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { X10Match, X10MatchStatus, X10Player, X10Winner } from '@/@types/x10';
import { X10_CONFIG } from '@/lib/config';

// Кэш для часто используемых значений
const PRIZE_DISTRIBUTION: Record<0 | 1 | 2 | 3, number> = {
  0: X10_CONFIG.PRIZES.CONSOLATION_TICKET, // Утешительный приз (1 билет)
  1: X10_CONFIG.PRIZES.FIRST,  // 450
  2: X10_CONFIG.PRIZES.SECOND, // 270
  3: X10_CONFIG.PRIZES.THIRD   // 180
};

const TOTAL_PRIZE = X10_CONFIG.PRIZES.FIRST + X10_CONFIG.PRIZES.SECOND + X10_CONFIG.PRIZES.THIRD;

export type X10GameState = {
  gameId: string;
  status: X10MatchStatus;
  currentPlayers: number;
  players: X10Player[];
  winners?: X10Winner[];
};

/**
 * Генерирует уникальный ID для матча
 */
export function generateMatchId(): string {
  return uuidv4();
}

/**
 * Проверяет, готов ли матч к началу игры
 */
export function isReadyToPlay(match: X10Match | null): boolean {
  return match?.players.length === X10_CONFIG.MATCH.MAX_PLAYERS;
}

/**
 * Проверяет баланс для участия в игре
 * @param balance Объект баланса с полем chance для активных билетов
 */
export function canPlayWithBalance(balance: { chance: number }): boolean {
  return balance.chance >= X10_CONFIG.TICKETS.GAME.COST;
}

/**
 * Получает призы для победителей
 */
export function getPrizeDistribution(): typeof PRIZE_DISTRIBUTION {
  return PRIZE_DISTRIBUTION;
}

/**
 * Проверяет корректность распределения призов
 */
export function validateWinners(winners: X10Winner[]): boolean {
  // Проверяем только призовые места (1-3)
  const prizePositions = winners.filter(w => w.position > 0).map(w => w.position);
  const uniquePrizePositions = new Set(prizePositions);
  
  // Должно быть ровно 3 уникальных призовых места
  if (uniquePrizePositions.size !== X10_CONFIG.WINNERS_COUNT) return false;
  
  return winners.every(w => {
    // Для утешительного приза (позиция 0)
    if (w.position === 0) {
      return w.prize === PRIZE_DISTRIBUTION[0];
    }
    // Для призовых мест (1-3)
    if (w.position >= 1 && w.position <= 3) {
      return PRIZE_DISTRIBUTION[w.position as 1 | 2 | 3] === w.prize;
    }
    return false;
  });
}

/**
 * Форматирует оставшееся время
 */
export function formatTimeLeft(endTime: number): string {
  const timeLeft = Math.max(0, endTime - Date.now());
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Создает стандартный ответ с ошибкой
 */
export function createErrorResponse(message: string, status: number = 400): Response {
  console.error('[X10Utils] Error:', message);
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Создает стандартный успешный ответ
 */
export function createSuccessResponse(data: any): Response {
  return NextResponse.json({ success: true, data });
}

/**
 * Вычисляет призовой фонд матча
 */
export function calculatePrizePool(): number {
  return TOTAL_PRIZE;
}

/**
 * Получает статус матча в текстовом виде
 */
export function getMatchStatusText(
  status: X10MatchStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case 'waiting':
      return t('x10.match.status.waiting');
    case 'playing':
      return t('x10.match.status.playing');
    case 'completed':
      return t('x10.match.status.completed');
    case 'canceled':
      return t('x10.match.status.canceled');
    default:
      return t('x10.match.status.unknown');
  }
}

/**
 * Форматирует время ожидания
 */
export function formatWaitingTime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
} 