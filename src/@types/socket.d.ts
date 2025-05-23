import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Socket as SocketIOClient } from 'socket.io-client';

// Типы для клиентских событий (отправка от клиента на сервер)
export interface ClientToServerEvents {
  // Присоединение к комнате ожидания
  join_waiting_room: (data: { telegramId: number; username: string; ticketsAmount?: number }) => void;
  
  // Отмена ожидания
  cancel_waiting: (data: { telegramId: number }) => void;
  
  // Завершение игры и отправка результата
  complete_game: (data: { 
    matchId: string;
    winnerId: number | null;
    player1Id: number;
    player2Id: number;
    ticketsAmount: number;
  }) => void;
}

// Типы для серверных событий (отправка от сервера клиенту)
export interface ServerToClientEvents {
  // Найден соперник
  opponent_found: (matchData: {
    matchId: string;
    player1Id: number;
    player1Name: string;
    player2Id: number;
    player2Name: string;
    ticketsAmount: number;
    createdAt: Date;
  }) => void;
  
  // Игра отменена
  game_canceled: (reason: string) => void;
  
  // Игра завершена
  game_completed: (result: {
    matchId: string;
    winnerId: number | null;
    ticketsAmount: number;
    isWinner: boolean;
  }) => void;
  
  // Ошибка
  error: (message: string) => void;
}

// Типы для межсерверных событий (для комнат и пространств имен)
export interface InterServerEvents {
  ping: () => void;
}

// Типы для данных сокета
export interface SocketData {
  telegramId?: number;
  username?: string;
  joinedAt?: Date;
}

// Расширение Next.js для поддержки Socket.IO
export type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetServer & {
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  };
};

// Тип для хука useSocket
export type UseSocketReturnType = {
  socket: SocketIOClient<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  lastError?: string | null;
  connect: () => void;
  disconnect: () => void;
  emit?: <T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ) => boolean;
  on?: <T extends keyof ServerToClientEvents>(
    event: T,
    callback: ServerToClientEvents[T]
  ) => () => void;
}; 