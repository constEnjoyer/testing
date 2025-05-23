# Инструкция по очистке режима имитации X10 🧹

## 1. Файлы для удаления

### 1.1 Утилиты разработки
```bash
src/utils/devUtils.ts              # Фейковые данные и имитация
```

## 2. Код для удаления

### 2.1 В конфигурации (`src/lib/config.ts`)
```typescript
// Удалить:
export const ENABLE_X10_SIMULATION = IS_DEV_MODE && process.env.NEXT_PUBLIC_ENABLE_X10_SIMULATION === 'true';
export const DEV_TIMINGS = { ... };
```

### 2.2 В GameRoomX10Container
```typescript
// Удалить все блоки:
if (ENABLE_X10_SIMULATION) {
  // ...
}
```

### 2.3 В хуках
```typescript
// Удалить из useSocketX10.ts:
if (ENABLE_X10_SIMULATION) {
  // ...
}
```

## 3. Переменные окружения
1. Удалить из `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_X10_SIMULATION=true
```

2. Удалить из `package.json`:
```json
"dev:simulation": "NEXT_PUBLIC_ENABLE_X10_SIMULATION=true next dev"
```

## 4. Проверка перед удалением
1. Убедиться, что все реальные эндпоинты работают
2. Проверить работу WebSocket соединения
3. Протестировать создание матча
4. Проверить все анимации с реальными данными

## 5. Полный игровой процесс X10

### 5.1 Последовательность фаз
1. **Waiting** (до 10 игроков)
   - Показ экрана ожидания
   - Возможность отмены

2. **Preparing** (5 секунд)
   - Показ всех игроков
   - Обратный отсчет

3. **Merging** (7.5 секунд)
   - Анимация слияния билетов
   - Звуковые эффекты

4. **Wheel** (последовательно)
   - Появление колеса (1 сек)
   - Вращение (5 сек)
   - Остановка и показ победителей
   - Исчезновение (1 сек)

5. **Results** (показ до закрытия)
   - Отображение выигрыша/проигрыша
   - Показ всех победителей
   - Обновление баланса
   - Кнопка "Играть снова"

### 5.2 Тайминги и события
```typescript
const GAME_TIMINGS = {
  PREPARING: 5000,
  MERGING: 7500,
  WHEEL_APPEAR: 1000,
  WHEEL_SPIN: 5000,
  WHEEL_DISAPPEAR: 1000,
  RESULTS_DELAY: 500  // Задержка перед показом результатов
};
```

## 6. Проверка после очистки
1. Запустить `pnpm build`
2. Проверить размер бандла
3. Убедиться в отсутствии dev-кода
4. Протестировать все игровые сценарии

## 7. Бэкап (на всякий случай)
1. Сделать коммит перед удалением:
```bash
git checkout -b backup/simulation-mode
git add .
git commit -m "backup: simulation mode before cleanup"
git push origin backup/simulation-mode
```

2. После успешной очистки:
```bash
git checkout main
git branch -D backup/simulation-mode  # Только если всё работает
```

🎯 **Важно:** Удаление проводить только после полного тестирования production версии! 