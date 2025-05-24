'use client';

// Объявление типа для Telegram объекта в window
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe: {
          user?: {
            id: number;
            [key: string]: any;
          };
          [key: string]: any;
        };
        [key: string]: any;
      };
    };
    // Добавляем объявление типа для флага разблокировки аудио
    __audioUnlocked?: boolean;
    AudioContext: typeof AudioContext;
  }
}

import { type PropsWithChildren, useEffect, useState, createContext, useRef, useCallback, useMemo } from 'react';
import {
  initData,
  miniApp,
  useLaunchParams,
  useSignal,
} from '@telegram-apps/sdk-react';
import { TonConnectUIProvider, THEME } from '@tonconnect/ui-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { GameSoundProvider } from '@/contexts/GameSoundContext';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useTelegramMock } from '@/hooks/useTelegramMock';
import { useDidMount } from '@/hooks/useDidMount';
import { useClientOnce } from '@/hooks/useClientOnce';
import { setLocale } from '@/core/i18n/locale';
import { init } from '@/core/init';

import styles from './Root.module.css';

import { 
  getFromLocalStorage, 
  saveToLocalStorage, 
  STORAGE_KEYS 
} from '@/utils/storageUtils';

import { useTranslations } from 'next-intl';
import { useUser } from '@/contexts/UserContext';

// В начале файла добавляем тип
type AppLocale = 'ru' | 'en';

// Обновляем тип для звуковых эффектов
type GameEffect = 
  | 'spin' 
  | 'win' 
  | 'lose' 
  | 'merge'
  | 'wheel_appear'
  | 'wheel_spin'
  | 'wheel_disappear';

// Обновляем тип для контекста
export const SoundContext = createContext<{
  unlockAudio: () => void;
  playClickSound: () => void;
  playGameEffect: (effect: string, force?: boolean) => void;
  toggleMute: () => void;
  isMuted: boolean;
  cleanupSounds: () => void;
  playIntroSound: () => void;
  playCredoSound: () => void;
  stopCredoSound: () => void;
}>({
  unlockAudio: () => {},
  playClickSound: () => {},
  playGameEffect: () => {},
  toggleMute: () => {},
  isMuted: false,
  cleanupSounds: () => {},
  playIntroSound: () => {},
  playCredoSound: () => {},
  stopCredoSound: () => {}
});

export function GlobalSound() {
  // Рефы для звуков
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const introSoundRef = useRef<HTMLAudioElement | null>(null);
  const credoSoundRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);
  const wheelSpinSoundRef = useRef<HTMLAudioElement | null>(null);

  // Рефы для X10 звуков
  const x10CombineSoundRef = useRef<HTMLAudioElement | null>(null);
  const x10WheelAppearSoundRef = useRef<HTMLAudioElement | null>(null);
  const x10WheelSpinSoundRef = useRef<HTMLAudioElement | null>(null);
  const x10WheelDisappearSoundRef = useRef<HTMLAudioElement | null>(null);
  const x10WinSoundRef = useRef<HTMLAudioElement | null>(null);
  const x10LoseSoundRef = useRef<HTMLAudioElement | null>(null);

  // Обновляем определение устройства для более точного определения
  const deviceInfo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    return {
      isApple: /iphone|ipad|ipod|mac/.test(ua) || /iphone|ipad|ipod|mac/.test(platform),
      isIOS: /iphone|ipad|ipod/.test(ua) || /iphone|ipad|ipod/.test(platform),
      isAndroid: /android/.test(ua),
      isSafari: /safari/.test(ua) && !/chrome/.test(ua),
      isWebKit: /webkit/.test(ua),
      isMobile: /mobile|tablet|android|iphone|ipad|ipod/.test(ua) || 'ontouchstart' in window
    };
  }, []);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const savedState = getFromLocalStorage<string>(STORAGE_KEYS.SOUND_MUTED, 'false');
      return String(savedState) === 'true';
    } catch (e) {
      console.error('[Root] Ошибка при загрузке состояния звука:', e);
      return false;
    }
  });
  const musicInitializedRef = useRef<boolean>(false);
  const musicStartedRef = useRef<boolean>(false);
  const hasInteractedRef = useRef<boolean>(false);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  
  // Использую useRef для хранения функции handleUserInteraction
  // Это позволяет избежать циклической зависимости
  const handleUserInteractionRef = useRef<() => void>(() => {});
  
  // Функция создания аудио элемента
  const createAudio = useCallback((path: string, options: { volume?: number; loop?: boolean } = {}) => {
    try {
      const audio = new Audio(path);
      audio.preload = 'auto';
      
      // Добавляем атрибуты для работы в фоне
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.setAttribute('background', 'true');
      
      if (options.volume) audio.volume = options.volume;
      if (options.loop) audio.loop = options.loop;
      
      // Добавляем в массив и обработчик ошибок
      audioElementsRef.current.push(audio);
      audio.addEventListener('error', (e) => {
        console.error(`[Root] ❌ Ошибка загрузки звука ${path}:`, e);
      });
      
      return audio;
    } catch (error) {
      console.error(`[Root] ❌ Ошибка создания аудио ${path}:`, error);
      return null;
    }
  }, []);

  // Создаем статический экземпляр аудио для фоновой музыки
  const staticBackgroundMusic = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const audio = new Audio('/sounds/background.mp3');
    audio.loop = true;
    audio.volume = 0.3;
    return audio;
  }, []);

  // Оптимизируем разблокировку аудио
  const unlockAudio = useCallback(() => {
    if (isAudioUnlocked || !deviceInfo) return;

    try {
      console.log('[Root] 🔓 Попытка разблокировки аудио');
      
      const forceUnlock = async () => {
        try {
          // Разблокируем все аудио элементы
          const unlockPromises = audioElementsRef.current.map(async (audio) => {
            if (audio) {
              try {
                audio.setAttribute('playsinline', '');
                audio.setAttribute('webkit-playsinline', '');
                audio.setAttribute('background', 'true');
                
                audio.muted = true;
                await audio.play();
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
                return true;
              } catch (e) {
                console.warn('[Root] Не удалось разблокировать аудио элемент:', e);
                return false;
              }
            }
            return true;
          });

          const results = await Promise.all(unlockPromises);
          const allUnlocked = results.every(result => result);
          
          if (allUnlocked) {
            console.log('[Root] ✅ Все аудио элементы разблокированы');
            setIsAudioUnlocked(true);
            hasInteractedRef.current = true;

            // После разблокировки запускаем фоновую музыку
            if (backgroundMusicRef.current && !isMuted) {
              console.log('[Root] 🎵 Запуск фоновой музыки после разблокировки');
              await backgroundMusicRef.current.play();
            }
          }
        } catch (e) {
          console.error('[Root] Ошибка при разблокировке:', e);
        }
      };

      forceUnlock();
    } catch (error) {
      console.error('[Root] ❌ Критическая ошибка при разблокировке аудио:', error);
    }
  }, [deviceInfo, isAudioUnlocked, isMuted]);

  // Одноразовая инициализация аудио
  useEffect(() => {
    if (typeof Audio !== 'undefined' && !musicInitializedRef.current && deviceInfo) {
      musicInitializedRef.current = true;
      console.log('[Root] 🎵 Инициализация аудио системы');
      
      // Используем статический экземпляр для фоновой музыки
      backgroundMusicRef.current = staticBackgroundMusic;
      
      // Создаем остальные звуки
      clickSoundRef.current = createAudio('/sounds/click.mp3', { volume: 0.5 });
      introSoundRef.current = createAudio('/sounds/introsound.mp3', { volume: 0.5 });
      winSoundRef.current = createAudio('/sounds/win.mp3', { volume: 0.6 });
      loseSoundRef.current = createAudio('/sounds/lose.mp3', { volume: 0.6 });
      wheelSpinSoundRef.current = createAudio('/sounds/wheel-spin.mp3', { volume: 0.5, loop: true });
      
      // Создаем звук для кредо
      const currentLang = getFromLocalStorage<'ru' | 'en'>(STORAGE_KEYS.APP_LOCALE, 'ru');
      const credoSoundFile = currentLang === 'en' ? '/sounds/credoen.mp3' : '/sounds/credoru.mp3';
      credoSoundRef.current = createAudio(credoSoundFile, { volume: 0.5 });

      // Инициализация X10 звуков
      x10CombineSoundRef.current = createAudio('/sounds/combine.mp3', { volume: 0.5 });
      x10WheelAppearSoundRef.current = createAudio('/sounds/appear.mp3', { volume: 0.5 });
      x10WheelSpinSoundRef.current = createAudio('/sounds/x10-spin-wheel.mp3', { volume: 0.5, loop: true });
      x10WheelDisappearSoundRef.current = createAudio('/sounds/disappear.mp3', { volume: 0.5 });
      x10WinSoundRef.current = createAudio('/sounds/win.mp3', { volume: 0.6 });
      x10LoseSoundRef.current = createAudio('/sounds/lose.mp3', { volume: 0.6 });

      // Проверяем все звуки
      console.log('[Root] 🔍 Проверка звуковых файлов...');
      audioElementsRef.current.forEach((audio, index) => {
        if (audio) {
          audio.load();
          console.log(`[Root] ✅ Звук ${index + 1} загружен:`, audio.src);
        }
      });

      // Автоматически запускаем фоновую музыку
      setTimeout(() => {
        if (backgroundMusicRef.current && !isMuted) {
          console.log('[Root] 🎵 Автозапуск фоновой музыки');
          backgroundMusicRef.current.play().catch(err => {
            console.error('[Root] Ошибка автозапуска фоновой музыки:', err);
            // Пробуем разблокировать и запустить снова
            unlockAudio();
            setTimeout(() => {
              if (backgroundMusicRef.current) {
                backgroundMusicRef.current.play().catch(console.error);
              }
            }, 1000);
          });
        }
      }, 1000);
    }
  }, [deviceInfo, staticBackgroundMusic, createAudio, isMuted, unlockAudio]);

  // Добавляем эффект для автозапуска музыки при первом взаимодействии
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInteractedRef.current && backgroundMusicRef.current && !isMuted) {
        console.log('[Root] 🎵 Запуск музыки после первого взаимодействия');
        backgroundMusicRef.current.play().catch(console.error);
        hasInteractedRef.current = true;
      }
    };

    // Слушаем различные события взаимодействия
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isMuted]);

  // Добавляем состояние для отслеживания системного звука
  const [systemAudioState, setSystemAudioState] = useState<{
    isMuted: boolean;
    hasHeadphones: boolean;
  }>({ isMuted: false, hasHeadphones: false });

  // Функция для проверки состояния системного звука и наушников
  const checkSystemAudioState = useCallback(async () => {
    try {
      // Проверяем наличие наушников через Web Audio API
      const hasHeadphones = await navigator.mediaDevices
        .enumerateDevices()
        .then(devices => devices.some(device => 
          device.kind === 'audiooutput' && 
          device.label.toLowerCase().includes('headphone')
        ))
        .catch(() => false);

      // Проверяем системный звук (это примерная реализация, может потребоваться адаптация)
      const audio = new Audio();
      const isSystemMuted = audio.muted || audio.volume === 0;

      setSystemAudioState({
        isMuted: isSystemMuted,
        hasHeadphones
      });

      return { isMuted: isSystemMuted, hasHeadphones };
    } catch (error) {
      console.error('[Root] Ошибка при проверке системного звука:', error);
      return { isMuted: false, hasHeadphones: false };
    }
  }, []);

  // Обновляем функцию safePlaySound
  const safePlaySound = useCallback((
    soundRef: React.RefObject<HTMLAudioElement>,
    soundName: string,
    options: {
      volume?: number;
      loop?: boolean;
      playbackRate?: number;
      maxRetries?: number;
      forceRestart?: boolean;
    } = {}
  ) => {
    // Проверяем условия воспроизведения
    const canPlaySound = !isMuted && soundRef.current && (
      !systemAudioState.isMuted || // Если система не в беззвучном режиме
      systemAudioState.hasHeadphones // Или подключены наушники
    );

    if (!canPlaySound) {
      console.log(`[Root] 🔇 Пропуск звука ${soundName}`, {
        appMuted: isMuted,
        systemMuted: systemAudioState.isMuted,
        hasHeadphones: systemAudioState.hasHeadphones
      });
      return;
    }

    const {
      volume = 0.5,
      loop = false,
      playbackRate = 1.0,
      maxRetries = 3,
      forceRestart = false
    } = options;

    let currentRetry = 0;

    const attemptPlay = async () => {
      try {
        if (!soundRef.current) return;

        // Если звук уже играет и не требуется принудительный перезапуск, пропускаем
        if (!forceRestart && !soundRef.current.paused) {
          console.log(`[Root] 🎵 Звук ${soundName} уже воспроизводится`);
          return;
        }

        // Установка параметров без принудительной остановки
        soundRef.current.volume = deviceInfo?.isMobile ? volume * 0.8 : volume;
        soundRef.current.loop = loop;
        soundRef.current.playbackRate = playbackRate;

        // Если требуется перезапуск, сначала останавливаем
        if (forceRestart) {
          soundRef.current.currentTime = 0;
        }

        // Пробуем воспроизвести
        await soundRef.current.play();
        console.log(`[Root] 🔊 Звук ${soundName} успешно запущен`);

      } catch (error) {
        console.error(`[Root] ❌ Ошибка воспроизведения ${soundName}:`, error);

        if (currentRetry < maxRetries) {
          currentRetry++;
          setTimeout(attemptPlay, 100 * currentRetry);
        }
      }
    };

    attemptPlay();
  }, [isMuted, systemAudioState, deviceInfo]);

  // Добавляем эффект для отслеживания изменений системного звука
  useEffect(() => {
    // Начальная проверка
    checkSystemAudioState();

    // Слушаем изменения устройств
    if ('mediaDevices' in navigator) {
      navigator.mediaDevices.ondevicechange = () => {
        checkSystemAudioState();
      };
    }

    return () => {
      if ('mediaDevices' in navigator) {
        navigator.mediaDevices.ondevicechange = null;
      }
    };
  }, [checkSystemAudioState]);
  
  // Обновляем обработчик видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      try {
        if (!document.hidden) {
          console.log('[Root] 🔄 Возврат в приложение');
          
          checkSystemAudioState().then(({ isMuted: systemMuted, hasHeadphones }) => {
            if (!systemMuted || hasHeadphones) {
              if (backgroundMusicRef.current && !isMuted && hasInteractedRef.current) {
                console.log('[Root] 🎵 Возобновление фоновой музыки');
                backgroundMusicRef.current.play().catch(console.error);
              }
            }
          });
        } else {
          if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
            backgroundMusicRef.current.pause();
          }
        }
      } catch (error) {
        console.error('[Root] Ошибка при обработке видимости:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSystemAudioState, isMuted]);
  
  // Обновляем toggleMute
  const toggleMute = useCallback(() => {
    const newState = !isMuted;
    setIsMuted(newState);
    
    try {
      saveToLocalStorage(STORAGE_KEYS.SOUND_MUTED, String(newState));
      
      // Управляем только состоянием mute для всех звуков
      audioElementsRef.current.forEach(audio => {
        if (audio) {
          audio.muted = newState;
        }
      });

      // Специальная обработка для фоновой музыки
      if (backgroundMusicRef.current) {
        if (newState) {
          backgroundMusicRef.current.pause();
        } else if (hasInteractedRef.current) {
          backgroundMusicRef.current.play().catch(console.error);
        }
      }
    } catch (e) {
      console.error('[Root] Ошибка при переключении звука:', e);
    }
  }, [isMuted]);
  
  // Добавляем пул звуков клика
  const clickSoundPoolRef = useRef<HTMLAudioElement[]>([]);
  const clickSoundPoolSize = 3; // Размер пула

  // Инициализация пула звуков
  useEffect(() => {
    if (typeof Audio !== 'undefined' && clickSoundPoolRef.current.length === 0) {
      for (let i = 0; i < clickSoundPoolSize; i++) {
        const audio = new Audio('/sounds/click.mp3');
        audio.volume = 0.5;
        audio.preload = 'auto';
        clickSoundPoolRef.current.push(audio);
      }
      console.log('[Root] 🎵 Создан пул звуков клика');
    }
  }, []);
  
  // Общая функция для плавного затухания звука
  const fadeOutSound = useCallback((
    soundRef: React.RefObject<HTMLAudioElement>,
    duration: number = 500
  ) => {
    if (!soundRef.current) return;

    try {
      console.log('[Root] 🛑 Плавная остановка звука');
      const originalVolume = soundRef.current.volume;
      const fadeOut = setInterval(() => {
        if (soundRef.current) {
          if (soundRef.current.volume > 0.1) {
            soundRef.current.volume -= 0.1;
          } else {
            clearInterval(fadeOut);
            soundRef.current.pause();
            soundRef.current.currentTime = 0;
            soundRef.current.volume = originalVolume;
            if (soundRef.current.loop) soundRef.current.loop = false;
          }
        }
      }, duration / 5);

      // Гарантированная остановка
      setTimeout(() => {
        clearInterval(fadeOut);
        if (soundRef.current) {
          soundRef.current.pause();
          soundRef.current.currentTime = 0;
          soundRef.current.volume = originalVolume;
          if (soundRef.current.loop) soundRef.current.loop = false;
        }
      }, duration + 100);
    } catch (error) {
      console.error('[Root] ❌ Ошибка остановки звука:', error);
      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.currentTime = 0;
      }
    }
  }, []);

  // Обновляем playClickSound
  const playClickSound = useCallback(() => {
    try {
      // Разблокируем звук при первом клике
      if (!isAudioUnlocked) {
        console.log('[Root] 🔓 Разблокировка звука при первом клике');
        unlockAudio();
      }

      const availableSound = clickSoundPoolRef.current.find(sound => sound.paused);
      if (availableSound) {
        safePlaySound({ current: availableSound }, 'click', { 
          volume: 0.5,
          maxRetries: 2 // Уменьшаем количество попыток для клика
        });
      } else {
        console.log('[Root] ⚠️ Все звуки клика заняты, создаем новый');
        const newClick = new Audio('/sounds/click.mp3');
        newClick.volume = 0.5;
        clickSoundPoolRef.current.push(newClick);
        safePlaySound({ current: newClick }, 'click', { volume: 0.5 });
      }
    } catch (error) {
      console.error('[Root] Ошибка воспроизведения клика:', error);
    }
  }, [isAudioUnlocked, unlockAudio, safePlaySound]);

  const playWheelSpinSound = useCallback(() => {
    safePlaySound(wheelSpinSoundRef, 'wheel_spin', { volume: 0.5, loop: true });
  }, [safePlaySound]);

  const stopWheelSpinSound = useCallback(() => {
    fadeOutSound(wheelSpinSoundRef);
  }, [fadeOutSound]);

  const playWinSound = useCallback(() => {
    safePlaySound(winSoundRef, 'win', { volume: 0.6 });
  }, [safePlaySound]);

  const playLoseSound = useCallback(() => {
    safePlaySound(loseSoundRef, 'lose', { volume: 0.6 });
  }, [safePlaySound]);

  const cleanupSounds = useCallback(() => {
    console.log('[Root] 🎵 Очистка звуков');
    
    const stopSound = (audio: HTMLAudioElement | null) => {
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
        if (audio.loop) audio.loop = false;
      } catch (error) {
        console.error('[Root] ❌ Ошибка при очистке звука:', error);
      }
    };

    // Очищаем все зацикленные звуки
    [
      wheelSpinSoundRef.current, // Добавляем X2 звук вращения
      x10WheelSpinSoundRef.current,
      x10WheelDisappearSoundRef.current
    ].forEach(audio => {
      if (audio && !audio.paused) {
        console.log('[Root] 🔄 Останавливаем активный звук:', audio.src);
        stopSound(audio);
      }
    });
  }, []);

  // Обновляем playGameEffect
  const playGameEffect = useCallback(async (effect: string, force = false) => {
    if (!hasInteractedRef.current && !force) return;

    console.log('[Root] 🎵 Воспроизведение эффекта:', effect);

    const playSound = async (ref: React.RefObject<HTMLAudioElement>, shouldLoop = false) => {
      if (!ref.current) return;
      try {
        ref.current.currentTime = 0;
        if (shouldLoop) {
          ref.current.loop = true;
        }
        await ref.current.play();
      } catch (error) {
        console.error('[Root] ❌ Ошибка воспроизведения звука:', error);
      }
    };

    try {
      // Определяем, какой звук воспроизводить
      switch (effect) {
        // X10 звуки
        case 'merge':
          await playSound(x10CombineSoundRef);
          break;
        case 'wheel_appear':
          await playSound(x10WheelAppearSoundRef);
          break;
        case 'wheel_spin':
          await playSound(x10WheelSpinSoundRef, true);
          break;
        case 'wheel_disappear':
          // Останавливаем звук вращения перед исчезновением
          if (x10WheelSpinSoundRef.current) {
            x10WheelSpinSoundRef.current.pause();
            x10WheelSpinSoundRef.current.currentTime = 0;
          }
          await playSound(x10WheelDisappearSoundRef);
          break;
        
        // X2 звуки
        case 'spin':
          await playSound(wheelSpinSoundRef, true);
          break;
        case 'win':
          await playSound(winSoundRef);
          break;
        case 'lose':
          await playSound(loseSoundRef);
          break;
      }
    } catch (error) {
      console.error('[Root] ❌ Ошибка в playGameEffect:', error);
    }
  }, [hasInteractedRef]);

  const playIntroSound = useCallback(() => {
    if (!hasInteractedRef.current) {
      console.log('[Root] 🔓 Разблокировка звука при первом взаимодействии');
      unlockAudio();
      return;
    }

    // Если уже разблокировано, просто запускаем intro
    if (introSoundRef.current && !isMuted) {
      console.log('[Root] 🎵 Воспроизведение интро звука');
      introSoundRef.current.play().catch(error => {
        console.error('[Root] Ошибка воспроизведения интро звука:', error);
      });
    }
  }, [unlockAudio, isMuted]);

  const playCredoSound = useCallback(() => {
    if (!credoSoundRef.current || isMuted) return;

    try {
      // Получаем текущий язык напрямую из localStorage и из документа
      const storedLang = getFromLocalStorage<'ru' | 'en'>(STORAGE_KEYS.APP_LOCALE, 'ru');
      const htmlLang = document.documentElement.lang;
      console.log('[Root] 🔍 Проверка языка:', {
        storedLang,
        htmlLang,
        currentSrc: credoSoundRef.current.src
      });

      // Используем язык из HTML
      const currentLang = htmlLang as 'en' | 'ru' || storedLang;
      const soundFile = currentLang === 'en' ? '/sounds/credoen.mp3' : '/sounds/credoru.mp3';
      
      console.log('[Root] 🌍 Воспроизведение кредо:', {
        currentLang,
        soundFile,
        currentSrc: credoSoundRef.current.src
      });

      // Проверяем и обновляем источник если нужно
      const newSrc = new URL(soundFile, window.location.origin).href;
      if (credoSoundRef.current.src !== newSrc) {
        console.log('[Root] 🔄 Обновляем источник кредо:', {
          oldSrc: credoSoundRef.current.src,
          newSrc
        });
        credoSoundRef.current.src = newSrc;
        credoSoundRef.current.load();
      }

      safePlaySound(credoSoundRef, 'credo', { volume: 0.5 });
    } catch (error) {
      console.error('[Root] Ошибка при воспроизведении кредо:', error);
    }
  }, [isMuted, safePlaySound]);

  const stopCredoSound = useCallback(() => {
    if (credoSoundRef.current) {
      credoSoundRef.current.pause();
      credoSoundRef.current.currentTime = 0;
    }
  }, []);

  // Обработчик изменения языка
  useEffect(() => {
    console.log('[Root] 🎯 Установка обработчика смены языка');
    
    const handleLocaleChange = (event: CustomEvent<{ locale: string }>) => {
      console.log('[Root] 🌍 Язык изменен на:', event.detail.locale);
      console.log('[Root] 📢 Текущий источник кредо:', credoSoundRef.current?.src);
      
      if (credoSoundRef.current) {
        const soundFile = event.detail.locale === 'en' ? '/sounds/credoen.mp3' : '/sounds/credoru.mp3';
        console.log('[Root] 🔄 Принудительное обновление источника кредо на:', soundFile);
        
        // Останавливаем текущее воспроизведение
        credoSoundRef.current.pause();
        credoSoundRef.current.currentTime = 0;
        
        // Обновляем источник
        credoSoundRef.current.src = soundFile;
        
        // Принудительно перезагружаем
        credoSoundRef.current.load();
        
        console.log('[Root] ✅ Источник кредо обновлен на:', credoSoundRef.current.src);
      } else {
        console.warn('[Root] ⚠️ credoSoundRef не инициализирован');
      }
    };

    window.addEventListener('app-locale-changed', handleLocaleChange as EventListener);
    
    return () => {
      window.removeEventListener('app-locale-changed', handleLocaleChange as EventListener);
    };
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Сохраняем позицию воспроизведения при размонтировании
      if (backgroundMusicRef.current) {
        saveToLocalStorage(STORAGE_KEYS.BACKGROUND_MUSIC_POSITION, 
          backgroundMusicRef.current.currentTime.toString()
        );
      }
    };
  }, []);

  return {
    unlockAudio,
    playClickSound,
    playGameEffect,
    toggleMute,
    isMuted,
    cleanupSounds,
    playIntroSound,
    playCredoSound,
    stopCredoSound
  };
}

function RootInner({ children }: PropsWithChildren) {
  const isDev = process.env.NODE_ENV === 'development';
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useUser();
  const initDataState = useSignal(initData.state);

  // Mock Telegram environment in development mode if needed.
  if (isDev) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTelegramMock();
  }

  // Initialize the library first
  useClientOnce(() => {
    init(isDev || window?.Telegram?.WebApp?.initDataUnsafe?.start_param === 'debug');
    setIsInitialized(true);
  });

  // Логируем состояние инициализации
  useEffect(() => {
    if (isInitialized && user?.telegramId) {
      console.log('[Root] 🚀 SDK инициализирован:', {
        isInitialized,
        hasUser: !!user?.telegramId
      });
    }
  }, [isInitialized, user?.telegramId]);

  // Only use launch params after initialization
  const launchParams = useLaunchParams();
  const debug = isDev || launchParams.startParam === 'debug';

  // Заменяем useSignal на useState с useEffect
  const [isDark, setIsDark] = useState<boolean | undefined>(miniApp.isDark);
  const [initDataUser, setInitDataUser] = useState(initData.user);

  // Следим за изменениями темы
  useEffect(() => {
    const themeCheckInterval = setInterval(() => {
      if (miniApp.isDark !== isDark) {
        setIsDark(miniApp.isDark);
      }
    }, 1000);
    
    return () => {
      clearInterval(themeCheckInterval);
    };
  }, [isDark]);
  
  // Следим за изменениями пользователя
  useEffect(() => {
    const userCheckInterval = setInterval(() => {
      if (initData.user !== initDataUser) {
        setInitDataUser(initData.user);
      }
    }, 1000);
    
    return () => {
      clearInterval(userCheckInterval);
    };
  }, [initDataUser]);
  
  // Set the user locale.
  useEffect(() => {
    initDataUser && setLocale(initDataUser.languageCode);
  }, [initDataUser]);

  // Создаем экземпляр GlobalSound
  const soundContextValue = GlobalSound();

  // Показываем загрузку до инициализации
  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return (
    <SoundContext.Provider value={soundContextValue}>
      <GameSoundProvider>
        <TonConnectUIProvider 
          manifestUrl="https://tonot-chance.vercel.app/tonconnect-manifest.json"
          uiPreferences={{ theme: THEME.DARK }}
        >
          <AppRoot
            appearance={(isDark !== undefined && isDark) ? 'dark' : 'light'}
            platform={['macos', 'ios'].includes(launchParams.platform) ? 'ios' : 'base'}
          >
            {children}
          </AppRoot>
        </TonConnectUIProvider>
      </GameSoundProvider>
    </SoundContext.Provider>
  );
}

// Функция для сохранения ID пользователя Telegram в localStorage
const saveTelegramUserId = (userId: number | string) => {
  saveToLocalStorage(STORAGE_KEYS.TELEGRAM_USER_ID, userId.toString());
};

// Функция для получения ID пользователя Telegram из данных WebApp
const getTelegramUserIdFromSession = (): number | null => {
  try {
    // Проверяем, существует ли объект window.Telegram
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      const webAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
      
      if (webAppUser && webAppUser.id) {
        // Сохраняем ID пользователя в localStorage для использования в других компонентах
        saveTelegramUserId(webAppUser.id);
        return webAppUser.id;
      }
    }
    
    // Если не удалось получить ID из WebApp, проверяем localStorage
    if (typeof window !== 'undefined') {
      const savedId = getFromLocalStorage(STORAGE_KEYS.TELEGRAM_USER_ID, null);
      if (savedId) {
        console.log('[Root] Используем сохраненный ID пользователя из localStorage:', savedId);
        return parseInt(savedId, 10);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Root] Ошибка при получении Telegram ID:', error);
    return null;
  }
};

export function Root(props: PropsWithChildren) {
  const [isMounted, setIsMounted] = useState(false);
  const t = useTranslations('i18n');
  
  useEffect(() => {
    setIsMounted(true);
    
    // Функция для загрузки языка из профиля пользователя
    const fetchUserLocale = async () => {
      try {
        // Проверяем, есть ли Telegram данные пользователя
        const telegramId = getTelegramUserIdFromSession();
        if (!telegramId) return;
        
        // Получаем сохраненную локаль из localStorage
        const savedLocale = getFromLocalStorage(STORAGE_KEYS.APP_LOCALE, null);
        
        // Используем новый специализированный API для локали
        const response = await fetch(`/api/user-locale?telegramId=${telegramId}${savedLocale ? `&preferred=${savedLocale}` : ''}`);
        
        if (response.ok) {
          const userData = await response.json();
          
          if (userData.success && userData.data && userData.data.locale) {
            const userLocale = userData.data.locale;
            
            if (!savedLocale || userLocale !== savedLocale) {
              saveToLocalStorage(STORAGE_KEYS.APP_LOCALE, userLocale);
              document.documentElement.lang = userLocale;
              
              const event = new CustomEvent('app-locale-changed', { detail: { locale: userLocale } });
              window.dispatchEvent(event);
            }
          }
        }
      } catch (error) {
        console.error('[Root] Ошибка при получении языка пользователя:', error);
      }
    };
    
    fetchUserLocale();
  }, []);

  const didMount = useDidMount();

  if (isMounted) {
    return (
      <ErrorBoundary fallback={ErrorPage}>
        <RootInner {...props} />
      </ErrorBoundary>
    );
  }

  return <div className={styles.loading}>{t('loading')}</div>;
}