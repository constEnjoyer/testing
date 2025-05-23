import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { X10Match, X10Player, X10Winner } from './x10';
import { Socket as SocketIOClientSocket } from 'socket.io-client';

/**
 * События от сервера к клиенту
 */
export interface ServerToClientEvents {
  // Игровые события
  gameStarted: (data: { 
    matchId: string;
    startTime: Date;
    players: X10Player[];
  }) => void;

  gamePhase: (data: {
    matchId: string;
    phase: string;
    players?: X10Player[];
    winners?: X10Winner[];
  }) => void;

  // Системные события Socket.IO
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
  error: (message: string) => void;
  
  // Heartbeat события
  heartbeat: () => void;
  heartbeat_ack: () => void;
}

/**
 * События от клиента к серверу
 */
export interface ClientToServerEvents {
  joinX10Room: (
    data: { 
      matchId: string;
      telegramId: number;
      username: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void
  ) => void;

  // Heartbeat события
  heartbeat: () => void;
  heartbeat_ack: () => void;
}

/**
 * Тип для хука useSocketX10
 */
export interface UseSocketX10Return {
  // Сокет и состояние
  socket: SocketIOClientSocket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  lastError: string | null;
  
  // Методы подключения
  connect: () => Promise<boolean>;
  disconnect: () => void;
  
  // Игровые методы
  joinRoom: (data: { 
    telegramId: number; 
    username: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    match?: X10Match;
  }>;
  
  // События
  onGameStarted: (callback: ServerToClientEvents['gameStarted']) => () => void;
}

/**
 * Тип для Next.js API с Socket.IO
 */
export type X10NextApiResponse = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer<ServerToClientEvents, ClientToServerEvents>;
    };
  };
}; 