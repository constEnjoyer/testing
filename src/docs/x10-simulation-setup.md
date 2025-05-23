# Настройка режима имитации X10 для тестирования анимаций 🎮

## 1. Настройка окружения

### 1.1 Создать файл с фейковыми данными
```typescript
// src/utils/devUtils.ts
export const DEV_PLAYERS = [
  { telegramId: 1001, username: "Player1" },
  { telegramId: 1002, username: "Player2" },
  { telegramId: 1003, username: "Player3" },
  { telegramId: 1004, username: "Player4" },
  { telegramId: 1005, username: "Player5" },
  { telegramId: 1006, username: "Player6" },
  { telegramId: 1007, username: "Player7" },
  { telegramId: 1008, username: "Player8" },
  { telegramId: 1009, username: "Player9" },
  { telegramId: 1010, username: "Player10" }
];

export const DEV_WINNERS = [
  { telegramId: 1001, username: "Player1", prize: 450 },
  { telegramId: 1005, username: "Player5", prize: 270 },
  { telegramId: 1008, username: "Player8", prize: 180 }
];
```

### 1.2 Добавить переменные окружения
```bash
# .env.local
NEXT_PUBLIC_ENABLE_X10_SIMULATION=true
```

## 2. Модификация компонентов

### 2.1 Обновить GameRoomX10Container
```typescript
// src/components/GameRoomX10/GameRoomX10Container.tsx

import { ENABLE_X10_SIMULATION, GAME_TIMINGS } from '@/lib/config';
import { DEV_PLAYERS, DEV_WINNERS } from '@/utils/devUtils';

const GameRoomX10Container = () => {
  // ... существующий код ...

  const handleStartGame = async () => {
    if (ENABLE_X10_SIMULATION) {
      // 1. Фаза подготовки (5 секунд)
      setGameState({
        phase: 'preparing',
        players: DEV_PLAYERS,
        matchId: 'dev-match-1'
      });

      // 2. Фаза слияния (7.5 секунд)
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'merging'
        }));
      }, GAME_TIMINGS.PREPARING);

      // 3. Фаза колеса
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'wheel_appear'
        }));
      }, GAME_TIMINGS.PREPARING + GAME_TIMINGS.MERGING);

      // 4. Вращение колеса
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'wheel_spin',
          winners: DEV_WINNERS
        }));
      }, GAME_TIMINGS.PREPARING + GAME_TIMINGS.MERGING + GAME_TIMINGS.WHEEL_APPEAR);

      // 5. Исчезновение колеса
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'wheel_disappear'
        }));
      }, GAME_TIMINGS.PREPARING + GAME_TIMINGS.MERGING + GAME_TIMINGS.WHEEL_APPEAR + GAME_TIMINGS.WHEEL_SPIN);

      // 6. Показ результатов
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: 'results'
        }));
      }, GAME_TIMINGS.PREPARING + GAME_TIMINGS.MERGING + GAME_TIMINGS.WHEEL_APPEAR + 
         GAME_TIMINGS.WHEEL_SPIN + GAME_TIMINGS.WHEEL_DISAPPEAR + GAME_TIMINGS.RESULTS_DELAY);

      return;
    }

    // Реальный код для production
    await createMatch();
  };

  // ... остальной код ...
};
```

### 2.2 Обновить конфигурацию
```typescript
// src/lib/config.ts

export const IS_DEV_MODE = process.env.NODE_ENV === 'development';
export const ENABLE_X10_SIMULATION = IS_DEV_MODE && process.env.NEXT_PUBLIC_ENABLE_X10_SIMULATION === 'true';

export const GAME_TIMINGS = {
  PREPARING: 5000,
  MERGING: 7500,
  WHEEL_APPEAR: 1000,
  WHEEL_SPIN: 5000,
  WHEEL_DISAPPEAR: 1000,
  RESULTS_DELAY: 500
};
```

## 3. Запуск и тестирование

### 3.1 Запуск в режиме разработки
```bash
# Добавить в package.json
"scripts": {
  "dev:simulation": "NEXT_PUBLIC_ENABLE_X10_SIMULATION=true next dev"
}

# Запустить
pnpm dev:simulation
```

### 3.2 Тестирование
1. Открыть http://localhost:3000/game-x10
2. Нажать на билет для старта игры
3. Наблюдать последовательность анимаций:
   - Preparing (5 сек)
   - Merging (7.5 сек)
   - Wheel появление (1 сек)
   - Wheel вращение (5 сек)
   - Wheel исчезновение (1 сек)
   - Results показ

## 4. Отладка анимаций

### 4.1 Проверка тайминга
```typescript
// В консоли браузера будут логи:
[X10] Phase: preparing
[X10] Phase: merging
[X10] Phase: wheel_appear
[X10] Phase: wheel_spin
[X10] Phase: wheel_disappear
[X10] Phase: results
```

### 4.2 Настройка тайминга
- Все значения можно настроить в `GAME_TIMINGS`
- Изменения применяются сразу при перезагрузке страницы
- Можно экспериментировать с разными значениями

## 5. Проверка всех элементов

### 5.1 Визуальные элементы
- [ ] Отображение всех 10 игроков
- [ ] Анимация слияния билетов
- [ ] Появление/вращение/исчезновение колеса
- [ ] Показ победителей
- [ ] Обновление баланса

### 5.2 Звуковые эффекты
- [ ] Звук начала игры
- [ ] Звук слияния билетов
- [ ] Звук вращения колеса
- [ ] Звук победы/проигрыша

## 6. Важные моменты
- Режим имитации работает только в development
- Все данные фейковые, нет обращений к БД
- WebSocket отключен в режиме имитации
- Баланс не меняется реально

🎮 **Запуск:**
1. `pnpm dev:simulation`
2. Открыть игру
3. Нажать на билет
4. Наблюдать все фазы анимации 