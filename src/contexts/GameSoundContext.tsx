'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { SoundContext } from '@/components/Root/Root';

// Типы звуковых эффектов игры
export type GameSoundEffect = 
  // Общие звуки результатов
  | 'win' 
  | 'lose'
  // Звуки X10
  | 'merge'
  | 'wheel_appear'
  | 'x10_wheel_spin'
  | 'wheel_disappear';

// Интерфейс контекста
interface GameSoundContextType {
  playGameSound: (effect: GameSoundEffect) => Promise<void>;
  stopGameSound: (effect: GameSoundEffect) => void;
  cleanup: () => void;
}

// Создаем контекст с начальными значениями
const GameSoundContext = createContext<GameSoundContextType>({
  playGameSound: async () => {},
  stopGameSound: () => {},
  cleanup: () => {}
});

// Хук для использования звуков в компонентах
export const useGameSound = () => useContext(GameSoundContext);

// Провайдер звуков
export const GameSoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Получаем функции из основного звукового контекста
  const { playGameEffect, cleanupSounds } = useContext(SoundContext);

  // Воспроизведение игровых звуков
  const playGameSound = useCallback(async (effect: GameSoundEffect) => {
    console.log('[GameSound] 🎵 Воспроизведение игрового звука:', effect, 'через GameSoundContext');

    try {
      switch (effect) {
        // X10 звуки
        case 'merge':
          await playGameEffect('merge');
          break;
        case 'wheel_appear':
          await playGameEffect('wheel_appear');
          break;
        case 'x10_wheel_spin':
          await playGameEffect('wheel_spin', true);
          break;
        case 'wheel_disappear':
          await playGameEffect('wheel_disappear');
          break;
        
        // Общие звуки результатов
        case 'win':
        case 'lose':
          console.log('[GameSound] 🎯 Запуск звука результата:', effect);
          await playGameEffect(effect);
          break;
      }
    } catch (error) {
      console.error('[GameSound] ❌ Ошибка воспроизведения звука:', error);
    }
  }, [playGameEffect]);

  // Остановка игровых звуков
  const stopGameSound = useCallback((effect: GameSoundEffect) => {
    console.log('[GameSound] 🛑 Остановка игрового звука:', effect, 'через GameSoundContext');
    
    // Останавливаем только зацикленные звуки X10
    if (effect === 'x10_wheel_spin') {
      console.log('[GameSound] 🔄 Очистка зацикленного звука:', effect);
      cleanupSounds();
    }
  }, [cleanupSounds]);

  // Значение контекста
  const contextValue = {
    playGameSound,
    stopGameSound,
    cleanup: cleanupSounds
  };

  return (
    <GameSoundContext.Provider value={contextValue}>
      {children}
    </GameSoundContext.Provider>
  );
}; 