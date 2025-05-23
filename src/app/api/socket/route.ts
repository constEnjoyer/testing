import { Server as SocketIOServer } from 'socket.io';
import type { ServerOptions } from 'socket.io';
import { createServer } from 'http';
import { NextRequest } from 'next/server';
import { handleX2Connection } from './x2/handlers';
import { handleX10Connection } from './x10/handlers';

// Кэшируем инстанс Socket.IO сервера
let io: SocketIOServer | null = null;

const WEBSOCKET_CONFIG: Partial<ServerOptions> = {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket'] as const,
  allowUpgrades: false,
  perMessageDeflate: false,
  httpCompression: false,
  maxHttpBufferSize: 1e6
};

export async function GET(req: NextRequest) {
  try {
    if (!io) {
      const httpServer = createServer();
      io = new SocketIOServer(httpServer, WEBSOCKET_CONFIG);

    // Общий обработчик подключений
    io.on('connection', (socket) => {
      const gameType = socket.handshake.query.gameType as string;
      const telegramId = socket.handshake.query.telegramId as string;

      if (!telegramId) {
        console.error('[Socket.IO] No telegramId provided');
        socket.disconnect();
        return;
      }

      console.log(`[Socket.IO] New connection: ${socket.id}, Game: ${gameType}, User: ${telegramId}`);

      // Направляем подключение к соответствующему обработчику
      if (gameType === 'x2') {
        handleX2Connection(socket);
      } else if (gameType === 'x10') {
        handleX10Connection(socket);
      } else {
        console.error(`[Socket.IO] Unknown game type: ${gameType}`);
        socket.disconnect();
      }
    });

      console.log('[Socket.IO] 🚀 Сервер инициализирован');
}

    // Обрабатываем WebSocket подключение
    const upgrade = req.headers.get('upgrade');
    if (upgrade?.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: WebSocket', { status: 426 });
    }

    // @ts-ignore - игнорируем ошибку типов для handleUpgrade
    const response = await io.engine.handleUpgrade(req);
    return response;
  } catch (error) {
    console.error('[Socket.IO] 💥 Ошибка при обработке WebSocket:', error);
    return new Response(null, { status: 500 });
  }
}

// Обработчик POST запросов
export async function POST(req: NextRequest) {
  try {
    if (!io) {
      const httpServer = createServer();
      io = new SocketIOServer(httpServer, WEBSOCKET_CONFIG);

      // Общий обработчик подключений
      io.on('connection', (socket) => {
        const gameType = socket.handshake.query.gameType as string;
        const telegramId = socket.handshake.query.telegramId as string;

        if (!telegramId) {
          console.error('[Socket.IO] No telegramId provided');
          socket.disconnect();
          return;
        }

        console.log(`[Socket.IO] New connection: ${socket.id}, Game: ${gameType}, User: ${telegramId}`);

        // Направляем подключение к соответствующему обработчику
        if (gameType === 'x2') {
          handleX2Connection(socket);
        } else if (gameType === 'x10') {
          handleX10Connection(socket);
        } else {
          console.error(`[Socket.IO] Unknown game type: ${gameType}`);
          socket.disconnect();
        }
      });
      
      console.log('[Socket.IO] 🚀 Сервер инициализирован');
    }

    // Обрабатываем WebSocket подключение
    const upgrade = req.headers.get('upgrade');
    if (upgrade?.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: WebSocket', { status: 426 });
    }

    // @ts-ignore - игнорируем ошибку типов для handleUpgrade
    const response = await io.engine.handleUpgrade(req);
    return response;
  } catch (error) {
    console.error('[Socket.IO] 💥 Ошибка при обработке WebSocket:', error);
    return new Response(null, { status: 500 });
  }
}

// Обработчик OPTIONS запросов для CORS
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 200, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  } });
}

// Функция для получения инстанса io
export async function getIO() {
  if (!io) {
    const httpServer = createServer();
    io = new SocketIOServer(httpServer, WEBSOCKET_CONFIG);

    // Общий обработчик подключений
    io.on('connection', (socket) => {
      const gameType = socket.handshake.query.gameType as string;
      const telegramId = socket.handshake.query.telegramId as string;

      if (!telegramId) {
        console.error('[Socket.IO] No telegramId provided');
        socket.disconnect();
        return;
      }

      console.log(`[Socket.IO] New connection: ${socket.id}, Game: ${gameType}, User: ${telegramId}`);

      // Направляем подключение к соответствующему обработчику
      if (gameType === 'x2') {
        handleX2Connection(socket);
      } else if (gameType === 'x10') {
        handleX10Connection(socket);
      } else {
        console.error(`[Socket.IO] Unknown game type: ${gameType}`);
        socket.disconnect();
      }
    });
    
    console.log('[Socket.IO] 🚀 Сервер инициализирован');
  }
  return io;
}

export { io }; 