// Объявление типов для переменных окружения
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_WALLET_ADDRESS: string;
      NEXT_PUBLIC_DEVELOPER_ADDRESS: string;
      NEXT_PUBLIC_TON_API_KEY: string;
      NEXT_PUBLIC_APP_URL: string;
      NEXT_PUBLIC_API_URL: string;
      MONGODB_URI: string;
      NEXT_PUBLIC_SOCKET_URL: string;
      SOCKET_CORS_ORIGIN: string;
      NEXT_PUBLIC_NETWORK: string;
      NEXT_PUBLIC_TICKET_PRICE: string;
      NEXT_PUBLIC_PLATFORM_FEE: string;
    }
  }
}

/**
 * Конфигурация приложения
 */
export const CONFIG = {
  // Адрес кошелька для приема платежей
  WALLET_ADDRESS: process.env.NEXT_PUBLIC_WALLET_ADDRESS,
  
  // Адрес кошелька разработчика для отправки TON
  DEVELOPER_ADDRESS: process.env.NEXT_PUBLIC_DEVELOPER_ADDRESS,
  
  // Настройки сети TON
  NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'mainnet',
  
  // API ключ TON
  TON_API_KEY: process.env.NEXT_PUBLIC_TON_API_KEY,
  
  // URL-адреса для приложения
  APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  API_URL: process.env.NEXT_PUBLIC_API_URL,
  
  // Настройки MongoDB
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Цена за 1 билет в TON
  TICKET_PRICE: Number(process.env.NEXT_PUBLIC_TICKET_PRICE) || 0.000000001,
  
  // Комиссия платформы в процентах
  PLATFORM_FEE: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE) || 5,
  
  // Параметры для хранения данных в localStorage
  STORAGE_KEYS: {
    AUTH: 'tonot_auth',
    USER: 'tonot_user',
    THEME: 'tonot_theme',
    LANG: 'tonot_lang',
    TELEGRAM_USER: 'telegram_user',
    ACCESS_TOKEN: 'access_token',
    TICKETS: 'tickets',                    // Активные билеты
    TONOT_CHANCE_TICKETS: 'tonotChanceTickets', // Пассивные билеты
    X10_GAME_STATE: 'x10_game_state'
  },
  
  // Максимальное количество попыток подключения к базе данных
  MAX_DB_CONNECT_RETRIES: 5,
  
  // Задержка между попытками подключения к базе данных (в миллисекундах)
  DB_RETRY_DELAY: 2000,

  // API эндпоинты
  API_ENDPOINTS: {
    // Основные эндпоинты
    USER_DATA: '/api/user-data',
    TELEGRAM_USER: '/api/telegram-user',
    TICKETS: '/api/tickets/purchase',
    
    // X2 эндпоинты (классическая игра)
    X2: {
      GAME: '/api/match/game',         // Получение информации об активной игре
      CREATE: '/api/match/create',      // Создание матча
      CANCEL: '/api/match/cancel',      // Отмена участия
      COMPLETE: '/api/match/complete'   // Завершение матча
    },
    
    // X10 эндпоинты (мультиплеер)
    X10: {
      GAME: '/api/match/x10/game',      // Получение информации об активной игре
      CREATE: '/api/match/x10/create',   // Создание нового матча
      CANCEL: '/api/match/x10/cancel',   // Отмена участия
      COMPLETE: '/api/match/x10/complete' // Завершение матча
    }
  }
};

/**
 * URL для WebSocket соединения
 */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

/**
 * Конфигурация для Socket.IO сервера
 */
export const SOCKET_CONFIG = {
  // CORS настройки
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  
  // Настройки пинга и таймаутов
  pingTimeout: 30000,
  pingInterval: 15000,
  connectTimeout: 10000,
  
  // Настройки переподключения
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
  
  // Настройки для игры
  waitingTimeout: 120000, // 2 минуты в миллисекундах
  matchTimeout: 300000,   // 5 минут в миллисекундах
  countdownTime: 5        // время обратного отсчета в секундах
};

/**
 * Конфигурация для режима X10
 */
export const X10_CONFIG = {
  // Основные настройки
  MIN_PLAYERS: 10, // Минимальное количество игроков для старта
  MAX_PLAYERS: 10, // Максимальное количество игроков в матче
  WINNERS_COUNT: 3, // Количество победителей
  
  // Для обратной совместимости
  PLAYERS: {
    MIN: 10,
    MAX: 10
  },
  
  // Настройки призов (в процентах от общего пула)
  PRIZE_DISTRIBUTION: {
    FIRST_PLACE: 50,  // 50% пула для первого места
    SECOND_PLACE: 30, // 30% пула для второго места
    THIRD_PLACE: 20   // 20% пула для третьего места
  },
  
  // Таймауты
  QUEUE_TIMEOUT: 600000,     // 10 минут на ожидание в очереди
  MATCH_TIMEOUT: 300000,     // 5 минут на игру
  COUNTDOWN_TIME: 10,        // 10 секунд обратный отсчет
  
  // Настройки переподключения
  MAX_RECONNECT_ATTEMPTS: 3, // Максимальное количество попыток переподключения
  RECONNECT_DELAY: 2000,     // Задержка между попытками переподключения (2 секунды)
  
  // Настройки билетов
  TICKETS: {
    // Активные билеты для игры (сгорают при использовании)
    GAME: {
      COST: 1,              // Стоимость участия (1 билет)
      FIELD_NAME: 'chance' // Название поля в API и базе данных
    },
    
    // Пассивные билеты TONOT CHANCE (начисляются за проигрыш)
    TONOT_CHANCE: {
      REWARD: 1,                        // Количество билетов за проигрыш
      FIELD_NAME: 'tonotChanceTickets'  // Название поля в API и базе данных
    }
  },

  // Настройки матча
  MATCH: {
    MIN_PLAYERS: 10,
    MAX_PLAYERS: 10,
    TIMEOUT: 300000, // 5 минут
    QUEUE_TIMEOUT: 600000 // 10 минут
  },

  // Настройки призов
  PRIZES: {
    FIRST: 450,   // 50% от 900
    SECOND: 270,  // 30% от 900
    THIRD: 180,   // 20% от 900
    CONSOLATION_TICKET: 1  // Утешительный билет для проигравших
  },

  // Тайминги анимаций
  GAME_TIMINGS: {
    PREPARING: 5000,    // 5 секунд countdown
    MERGING: 7500,      // 7.5 секунд (10 билетов * 1 сек / 1.25 скорость)
    WHEEL_APPEAR: 4000, // 4 секунды
    WHEEL_SPIN: 7000,   // 7 секунд
    WHEEL_STOP: 2000,   // 2 секунды
    RESULT: 1000        // 1 секунда
  } as const
} as const;

// Экспортируем также отдельные константы для обратной совместимости
export const MAX_PLAYERS = X10_CONFIG.MAX_PLAYERS;
export const MIN_PLAYERS = X10_CONFIG.MIN_PLAYERS;
export const MATCH_TIMEOUT = X10_CONFIG.MATCH_TIMEOUT;
export const QUEUE_TIMEOUT = X10_CONFIG.QUEUE_TIMEOUT;

/**
 * Конфигурация для работы с TON
 */
export const TON_CONFIG = {
  // Адрес TON кошелька приложения
  WALLET_ADDRESS: process.env.NEXT_PUBLIC_WALLET_ADDRESS || CONFIG.WALLET_ADDRESS,
  
  // Адрес кошелька разработчика
  DEVELOPER_ADDRESS: process.env.NEXT_PUBLIC_DEVELOPER_ADDRESS || CONFIG.DEVELOPER_ADDRESS,
  
  // API ключ для TON
  API_KEY: process.env.NEXT_PUBLIC_TON_API_KEY || CONFIG.TON_API_KEY
};

// Другие настройки приложения
export const APP_CONFIG = {
  buildTimeDBConnection: process.env.SKIP_DB_CONNECTION_DURING_BUILD !== 'true'
};

// Добавляем конфигурацию для режима симуляции
export const IS_DEV_MODE = process.env.NODE_ENV === 'development';

export default CONFIG; 