import type {
  ServerToClientEvents,
  ClientToServerEvents
} from './x10Socket.d';
import type { X10Winner } from './x10';

// Реэкспортируем типы для удобства использования
export type {
  ServerToClientEvents,
  ClientToServerEvents
};

/**
 * Форматирует данные для подключения к комнате X10
 */
export function formatJoinX10RoomData(telegramId: number, username: string) {
  return { telegramId, username };
}

/**
 * Проверяет, достаточно ли игроков для начала игры
 */
export function isReadyToPlay(players: number) {
  return players === 10;
}

/**
 * Валидирует список победителей
 * - Должно быть ровно 3 победителя
 * - Позиции должны быть уникальными (1, 2, 3)
 */
export function validatePrizes(winners: X10Winner[]) {
  if (winners.length !== 3) return false;
  
  const positions = new Set(winners.map(w => w.position));
  if (positions.size !== 3) return false;

  return true;
} 