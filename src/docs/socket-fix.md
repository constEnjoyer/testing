# 🔧 ПЛАН ИСПРАВЛЕНИЯ СОКЕТОВ X10

## 📁 Структура файлов сокетов:

### 1. Существующие файлы (НЕ ТРОГАЕМ):
```typescript
// 1. socket.d.ts - Типы для Next.js + Socket.IO
export interface NextApiResponseWithSocket = NextApiResponse & {
  socket: NetServer & {
    io: SocketIOServer<...>;  // Базовая интеграция с Next.js
  };
};

// 2. socket.ts - Типы для X2 клиента
export interface ServerToClientEvents {
  opponent_found: (matchData: {...}) => void;  // X2 события
  game_canceled: (reason: string) => void;     // X2 события
  game_completed: (result: {...}) => void;     // X2 события
}
```

### 2. Новые файлы (СОЗДАЕМ):
```typescript
// 1. x10Socket.d.ts - Типы для X10 + Next.js
export interface X10NextApiResponse = NextApiResponse & {
  socket: NetServer & {
    io: SocketIOServer<X10ServerEvents>;  // X10 специфичные события
  };
};

// 2. x10Socket.ts - Типы для X10 клиента
export interface X10ServerEvents {
  x10_player_joined: (data: {...}) => void;  // X10 события
  x10_game_starting: (data: {...}) => void;  // X10 события
  x10_merging_start: (data: {...}) => void;  // X10 события
}
```

### 3. Взаимодействие файлов:
```
socket.d.ts ────┐
                ├─── X2 комната (не трогаем)
socket.ts ──────┘

x10Socket.d.ts ─┐
                ├─── X10 комната (создаем)
x10Socket.ts ───┘
```

## 📊 Текущая реализация:

### 1. Работающий функционал:
```typescript
// 1. Вход в комнату X10
GameRoomX10Container
├── GameHeaderX10        // ✅ Показывает баланс
├── GameControlsX10      // ✅ Показывает билеты
├── WaitingOverlayX10    // ❌ Не работает ожидание
└── YinYangWheel        // ❌ Не работает вращение

// 2. Импорты и зависимости
import { useSocketX10 } from '@/hooks/useSocketX10';           // ❌ Не работает
import { useGameStateX10 } from '@/contexts/X10RoomContext';   // ✅ Работает
import { useTelegramUser } from '@/hooks/useTelegramUser';     // ✅ Работает
import { useUser } from '@/contexts/UserContext';              // ✅ Работает
```

### 2. Текущие импорты:
```typescript
// Работающие импорты (НЕ ТРОГАЕМ)
src/
├── contexts/
│   ├── UserContext.tsx         // ✅ Баланс и данные юзера
│   └── X10RoomContext.tsx      // ✅ Состояние комнаты
├── hooks/
│   ├── useTelegramUser.ts      // ✅ Telegram данные
│   └── useUser.ts              // ✅ Данные пользователя
└── components/
    └── GameRoomX10/           // ✅ Компоненты комнаты

// Проблемные импорты (ИСПРАВЛЯЕМ)
src/
├── @types/
│   ├── socket.d.ts           // ❌ Только X2 типы
│   └── socket.ts            // ❌ Только X2 события
├── hooks/
│   └── useSocketX10.ts      // ❌ Не работает с сокетами
└── app/api/
    └── socket/x10/route.ts  // ❌ Не работает namespace
```

## 📝 План миграции:

### 1️⃣ Этап 1 - Анализ и подготовка (День 1):
1. **Создание типов:**
   ```typescript
   // 1. Создаем x10Socket.d.ts
   export interface X10ServerEvents {
     x10_player_joined: ...
     x10_game_starting: ...
   }

   // 2. Создаем x10Socket.ts
   export interface X10ClientEvents {
     join_x10_room: ...
     leave_x10_room: ...
   }
   ```

2. **Проверка импортов:**
   - [ ] Составить карту всех импортов
   - [ ] Отметить критические зависимости
   - [ ] Подготовить план миграции

### 2️⃣ Этап 2 - Базовая интеграция (День 2):
1. **Обновление route.ts:**
   ```typescript
   // 1. Создаем namespace
   const x10Namespace = io.of('/x10');

   // 2. Добавляем обработчики
   x10Namespace.on('connection', (socket) => {
     // Обработка событий
   });
   ```

2. **Обновление useSocketX10:**
   - [ ] Подключение к namespace /x10
   - [ ] Базовые события (connect/disconnect)
   - [ ] Проверка работы соединения

### 3️⃣ Этап 3 - Игровая механика (День 3):
1. **Вход в игру:**
   ```typescript
   // 1. GameControlsX10
   const handleJoinRoom = () => {
     if (balance.chance > 0) {
       joinX10Room({...});  // Сжигание билета
     }
   };

   // 2. PlayersList
   onX10PlayerJoined((data) => {
     updatePlayers(data.players);  // Обновление списка
   });
   ```

2. **Анимации:**
   - [ ] Синхронизация слияния билетов
   - [ ] Управление колесом
   - [ ] Звуковые эффекты

### 4️⃣ Этап 4 - Тестирование (День 4):
1. **Проверка работы:**
   - [ ] Вход в комнату
   - [ ] Ожидание игроков
   - [ ] Анимации и звуки
   - [ ] Результаты

2. **Проверка баланса:**
   - [ ] Сжигание билетов
   - [ ] Начисление призов
   - [ ] Выдача билетов

### 5️⃣ Правила безопасности:

1. **НЕ ТРОГАТЬ:**
   ```typescript
   // Эти файлы не трогаем:
   src/contexts/UserContext.tsx     // Баланс
   src/hooks/useTelegramUser.ts    // Telegram
   src/app/api/socket/route.ts     // X2 сокеты
   ```

2. **ИЗМЕНЯТЬ ТОЛЬКО:**
   ```typescript
   // Только X10 файлы:
   src/@types/x10Socket.d.ts      // Новый файл
   src/hooks/useSocketX10.ts      // Обновляем
   src/app/api/socket/x10/route.ts // Обновляем
   ```

## 🔍 Мониторинг:

1. **Логи для отладки:**
   ```typescript
   // 1. Подключение
   [X10Socket] Connecting to namespace /x10...
   [X10Socket] Connected, telegramId: ${id}

   // 2. Игровой процесс
   [X10Game] Player joined: {position: 1}
   [X10Game] Players: ${currentPlayers}/10
   [X10Game] Starting animations...
   [X10Game] Game completed
   ```

2. **Проверки работы:**
   - [ ] Консоль без ошибок
   - [ ] Сетевые запросы успешны
   - [ ] Баланс обновляется
   - [ ] Звуки воспроизводятся

## 📅 Сроки:
- Анализ и подготовка: 1 день
- Базовая интеграция: 1 день
- Игровая механика: 2 дня
- Тестирование: 1 день
- Итого: 5 дней

## 🎮 Ожидаемый результат:
1. ✅ Работающие сокеты X10
2. ✅ Полный игровой цикл
3. ✅ Корректная работа с балансом
4. ✅ X2 комната работает без изменений

## 📝 Выполненные изменения (14.03.2024):

### 1. Анализ баланса и состояния:
- ✅ Подтверждено, что локальное состояние баланса в X10 - это правильное решение
- ✅ Баланс обновляется корректно через API
- ✅ Синхронизация с UserContext работает правильно

### 2. Исправление кнопки запуска в X10:
```typescript
// GameControlsX10.tsx
const canInteract = isBottom && gameStatus === 'waiting' && !isLoading;

return (
  <div 
    className={`
      ${styles.ticket} 
      ${isBottom ? styles.bottomTicket : ''} 
      ${isActive ? styles.active : ''}
    `}
    onClick={canInteract ? onJoinRoom : undefined}
    data-position={position}
  >
    // ... существующий код ...
  </div>
);
```

### 3. Логика запуска игры:
- ✅ Проверка баланса перед запуском
- ✅ Корректная обработка состояний кнопки
- ✅ Визуальная индикация активного состояния
- ✅ Интеграция с существующей системой ожидания игроков

### 4. Следующие шаги:
1. Тестирование полного цикла:
   - [ ] Вход в комнату
   - [ ] Ожидание игроков
   - [ ] Запуск игры
   - [ ] Обработка результатов

2. Проверка интеграции:
   - [ ] Работа сокетов
   - [ ] Обновление баланса
   - [ ] Анимации и звуки

## 📝 Последние изменения (09.04.2024):

### 1. Исправлена обработка игроков в GameRoomX10Container:
```typescript
// Оптимизирована обработка выхода игрока
const cleanupPlayerLeft = onX10PlayerLeft((data) => {
  console.log('[X10] Player left:', data);
  const updatedPlayers = players.filter((p: X10Player) => p.telegramId !== data.telegramId);
  setPlayers(updatedPlayers);
});

// Оптимизирована обработка входа игрока
const cleanupPlayerJoined = onX10PlayerJoined((data) => {
  console.log('[X10] Player joined:', data);
  if (!players.some((p: X10Player) => p.telegramId === data.player.telegramId)) {
    const updatedPlayers = [...players, data.player];
    setPlayers(updatedPlayers);
  }
});
```

### 2. Улучшения:
- ✅ Исправлен баг с дублированием игроков при входе
- ✅ Оптимизирована работа с массивом игроков
- ✅ Улучшена типизация обработчиков событий
- ✅ Добавлено логирование для отладки

### 3. Следующие шаги:
- [ ] Тестирование обновленной логики входа/выхода
- [ ] Проверка синхронизации состояния между игроками
- [ ] Мониторинг производительности обновленного кода

## 📝 Текущие проблемы (10.04.2024):

### 1. Проблемы с WebSocket:
```typescript
// 1. Неправильная обработка heartbeat сообщений
Received WebSocket message: { type: 'heartbeat', data: undefined }
Unhandled message type: heartbeat

// 2. Проблемы с подключением
[X10Socket] Connecting to namespace /x10...
Error: Connection failed
```

### 2. Анализ логов:
- ❌ Heartbeat сообщения не обрабатываются
- ❌ Частые переподключения к сокету
- ❌ Множественные запросы к API user-data
- ❌ Проблемы с синхронизацией состояния игры

### 3. Выявленные конфликты:
```typescript
// 1. Конфликт в route.ts
io = new SocketIOServer(httpServer, {
  transports: ['websocket'],  // ❌ Нет поддержки polling
  path: '/api/socket/x10'     // ❌ Возможный конфликт с клиентом
});

// 2. Конфликт в useSocketX10.ts
const socket = io({
  path: '/socket/x10',       // ❌ Несоответствие путей
  transports: ['websocket']  // ❌ Ограниченные транспорты
});
```

## 🔄 Обновленный план действий:

### 1️⃣ Исправление WebSocket конфигурации:
```typescript
// 1. В route.ts
io = new SocketIOServer(httpServer, {
  transports: ['websocket', 'polling'],
  path: '/api/socket',
  pingTimeout: 30000,
  pingInterval: 15000
});

// 2. В useSocketX10.ts
const socket = io({
  path: '/api/socket',
  transports: ['websocket', 'polling']
});
```

### 2️⃣ Добавление обработчиков heartbeat:
```typescript
// В route.ts
socket.on('heartbeat', () => {
  console.log('[X10Socket] 💓 Heartbeat от клиента:', socket.id);
  socket.emit('heartbeat_ack');
});

// В useSocketX10.ts
socket.on('heartbeat', () => {
  console.log('[X10Socket] 💓 Heartbeat от сервера');
  socket.emit('heartbeat_ack');
});
```

### 3️⃣ Оптимизация запросов:
- [ ] Кэширование user-data запросов
- [ ] Уменьшение частоты обновления баланса
- [ ] Оптимизация переподключений сокета

### 4️⃣ Приоритетные задачи:
1. Исправить обработку heartbeat сообщений
2. Синхронизировать конфигурацию WebSocket
3. Оптимизировать запросы к API
4. Улучшить обработку отключений

## 📊 Метрики для проверки:
- Время жизни WebSocket соединения
- Количество переподключений
- Частота запросов к API
- Задержка между событиями

## 🎯 Ожидаемые улучшения:
1. Стабильное WebSocket соединение
2. Корректная обработка всех событий
3. Оптимизированные запросы к API
4. Улучшенная производительность