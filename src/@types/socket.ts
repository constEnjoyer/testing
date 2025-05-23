import { Socket } from 'socket.io-client';

/**
 * События, отправляемые от сервера клиенту
 */
export interface ServerToClientEvents {
  // Системные события
  error: (message: string) => void;
  
  // Игровые события
  opponent_found: (matchData: {
    matchId: string;
    player1Id: number;
    player1Name: string;
    player2Id: number;
    player2Name: string;
    ticketsAmount: number;
    createdAt: Date;
  }) => void;
  
  game_canceled: (matchId: string) => void;
  
  game_completed: (result: {
    matchId: string;
    winnerId: number | null;
    ticketsAmount: number;
    isWinner: boolean;
  }) => void;
}

/**
 * События, отправляемые от клиента серверу
 */
export interface ClientToServerEvents {
  // Игровые события
  join_waiting_room: (data: {
    telegramId: number;
    ticketsAmount: number;
  }) => void;
  
  cancel_waiting: (telegramId: number) => void;
  
  complete_game: (data: {
    matchId: string;
    winnerId: number | null;
    player1Id: number;
    player2Id: number;
    ticketsAmount: number;
  }) => void;
}

/**
 * Интерфейс возвращаемого значения хука useSocket
 */
export interface UseSocketReturnType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  lastError: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: <T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ) => boolean;
  on: <T extends keyof ServerToClientEvents>(
    event: T,
    callback: ServerToClientEvents[T]
  ) => () => void;
} 