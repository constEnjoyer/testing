/**
 * Модуль утилит для игровой логики
 * Содержит функции для работы с игровыми данными, расчета результатов и форматирования
 */
import { Match, GameResult, GameStatus, GameSide, GameResultInfo } from '@/@types/game';

/**
 * Генерирует уникальный идентификатор матча
 * @returns строка с уникальным ID
 */
export function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Вычисляет результат игры на основе данных матча
 * @param match данные матча
 * @param userId ID текущего пользователя
 * @returns объект с результатами игры
 */
export function calculateGameResult(match: Match, userId: number): GameResultInfo {
  // Проверка на валидность данных матча
  if (!match || !match.matchId) {
    throw new Error('Недопустимые данные матча');
  }

  const isPlayer1 = match.player1Id === userId;
  const isPlayer2 = match.player2Id === userId;

  // Проверка что пользователь участвует в матче
  if (!isPlayer1 && !isPlayer2) {
    throw new Error('Пользователь не является участником этого матча');
  }

  // Если победитель не определен, то результат - ничья
  const isDraw = match.winnerId === null || match.winnerId === undefined;
  const isWinner = !isDraw && match.winnerId === userId;

  // Вычисляем заработанные/потерянные средства
  const ticketsAmount = match.ticketsAmount || 0;
  const ticketsChange = isDraw 
    ? 0 
    : isWinner 
      ? ticketsAmount 
      : -ticketsAmount;

  return {
    matchId: match.matchId,
    isDraw,
    isWinner,
    ticketsChange,
    opponentId: isPlayer1 ? match.player2Id : match.player1Id,
    opponentName: isPlayer1 ? match.player2Name : match.player1Name,
    completedAt: new Date(),
    status: isWinner ? 'win' : 'lose',
    ticketsAmount: Math.abs(ticketsChange)
  };
}

/**
 * Определяет статус игры на основе прогресса и текущего состояния
 * @param progress числовое значение прогресса игры (0-100)
 * @param currentStatus текущий статус игры
 * @returns обновленный статус игры
 */
export function determineGameStatus(
  progress: number, 
  currentStatus: GameStatus = 'not_started'
): GameStatus {
  // Если игра уже завершена или отменена, ее статус не меняется
  if (currentStatus === 'completed' || currentStatus === 'canceled') {
    return currentStatus;
  }

  if (progress <= 0) {
    return 'not_started';
  }
  
  if (progress < 100) {
    return 'in_progress';
  }
  
  return 'completed';
}

/**
 * Проверяет, может ли пользователь принять участие в игре
 * @param userBalance баланс пользователя
 * @param ticketsAmount стоимость участия в игре
 * @returns объект с результатом проверки и сообщением
 */
export function canUserPlayGame(
  userBalance: number,
  ticketsAmount: number
): { canPlay: boolean; message?: string } {
  if (typeof userBalance !== 'number' || typeof ticketsAmount !== 'number') {
    return { canPlay: false, message: 'Некорректные данные' };
  }

  if (userBalance < ticketsAmount) {
    return { 
      canPlay: false, 
      message: `Недостаточно билетов. Требуется: ${ticketsAmount}, доступно: ${userBalance}` 
    };
  }

  return { canPlay: true };
}

/**
 * Вычисляет прогнозируемое время ожидания оппонента в зависимости от количества активных игроков
 * @param activePlayers количество активных игроков
 * @returns оценочное время ожидания в секундах
 */
export function estimateWaitTime(activePlayers: number): number {
  if (activePlayers <= 0) {
    return 120; // По умолчанию 2 минуты если нет данных
  }
  
  // Чем больше игроков, тем меньше время ожидания
  const baseWaitTime = 60; // 1 минута
  const waitReduction = Math.min(50, activePlayers * 5);
  const estimatedWait = baseWaitTime - waitReduction;
  
  return Math.max(10, estimatedWait); // Минимум 10 секунд ожидания
}

/**
 * Получает текстовое описание состояния игры для отображения в интерфейсе
 * 
 * @param gameState - Текущее состояние игры
 * @param t - Функция для перевода из i18n
 * @param customMessage - Пользовательское сообщение (ошибка или результат)
 * @returns Текст для отображения
 */
export function getGameStateText(
  gameState: GameStatus, 
  t: (key: string, options?: any) => string,
  customMessage?: string
): string {
  if (customMessage) {
    return customMessage;
  }
  
  switch (gameState) {
    case 'not_started':
      return t('game.status.not_started');
    case 'waiting':
      return t('game.status.waiting');
    case 'in_progress':
      return t('game.status.in_progress');
    case 'completed':
      return t('game.status.completed');
    case 'canceled':
      return t('game.status.canceled');
    default:
      return t('game.status.unknown');
  }
}

/**
 * Вычисляет финальное положение колеса на основе результата
 * 
 * @param side - Выбранная сторона (Инь или Ян)
 * @param isWinner - Является ли игрок победителем
 * @returns Позиция для вращения колеса (в градусах)
 */
export function calculateWheelPosition(side: GameSide, isWinner: boolean): number {
  // Базовые позиции для Инь и Ян
  const yinPosition = 90;  // Инь вверху
  const yangPosition = 270; // Ян внизу

  // Если игрок победил, колесо должно остановиться на его стороне
  // Если проиграл - на противоположной
  if (side === 'yin') {
    return isWinner ? yinPosition : yangPosition;
  } else {
    return isWinner ? yangPosition : yinPosition;
  }
} 