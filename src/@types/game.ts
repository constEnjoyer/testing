/**
 * Типы для игровой логики
 */

/**
 * Фазы игрового процесса
 */
export enum GamePhase {
  IDLE = 'idle',           // Начальное состояние
  WAITING = 'waiting',     // Ожидание оппонента
  PLAYING = 'playing',     // Игра в процессе
  COUNTDOWN = 'countdown', // Обратный отсчет
  CHANCE = 'chance',      // Фаза шанса
  SPINNING = 'spinning',  // Вращение колеса
  RESULT = 'result',     // Показ результата
  COMPLETED = 'completed' // Игра завершена
}

/**
 * Возможные статусы игры
 */
export type GameStatus = 
  | 'not_started'   // Начальное состояние
  | 'idle'          // Начальное состояние
  | 'waiting'       // Ожидание оппонента
  | 'in_progress'   // Игра в процессе
  | 'completed'     // Игра завершена
  | 'canceled';     // Игра отменена

/**
 * Данные матча между двумя игроками
 */
export interface Match {
  matchId: string;          // Уникальный идентификатор матча
  player1Id: number;        // ID первого игрока
  player1Name: string;      // Имя первого игрока
  player2Id: number;        // ID второго игрока
  player2Name: string;      // Имя второго игрока
  ticketsAmount: number;    // Количество билетов (ставка)
  winnerId?: number;        // ID победителя
  createdAt: Date;          // Время создания матча
  completedAt?: Date;       // Время завершения матча
}

/**
 * Результат завершенной игры
 */
export interface GameResult {
  status: 'win' | 'lose';   // Статус для текущего игрока
  ticketsAmount: number;    // Количество выигранных/проигранных билетов
  winnerId?: number;        // ID победителя
}

/**
 * Состояние игры
 */
export interface GameState {
  status: GameStatus;       // Текущий статус игры
  phase: GamePhase;        // Текущая фаза игры
  match: Match | null;      // Данные текущего матча (null если нет активного матча)
  result: GameResult | null; // Результат последней игры (null если нет результата)
  error: string | null;     // Текст ошибки (null если нет ошибки)
  lastUpdated: Date;        // Время последнего обновления состояния
  countdown: number;        // Значение обратного отсчета
  waitingStartTime: number | null; // Время начала ожидания
  chancePhaseCompleted: boolean;   // Завершена ли фаза шанса
}

// Стороны для выбора
export type GameSide = 'yin' | 'yang';

// Результат игры (строковый тип для совместимости)
export type GameOutcome = 'win' | 'lose';

// Информация об игровом результате (расширенная)
export interface GameResultInfo extends GameResult {
  matchId: string;
  isDraw: boolean;
  isWinner: boolean;
  ticketsChange: number;
  opponentId: number;
  opponentName: string;
  completedAt: Date;
  winAmount?: number;
  side?: GameSide;
  position?: number;
}

// Информация об игре
export interface GameInfo {
  id: string;
  status: GameStatus;
  playerCount: number;
  ticketPrice: number;
  currentPot: number;
  createdAt: string;
  updatedAt: string;
} 