// Расширяем интерфейс Window
declare global {
  interface Window {
    isMenuTransitionInProgress: boolean;
  }
}

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './GameTransition.module.css';

interface GameTransitionProps {
  direction: 'toGame' | 'toMenu';
  onComplete: () => void;
}

export const GameTransition: React.FC<GameTransitionProps> = ({ direction, onComplete }) => {
  const router = useRouter();
  const [animationStage, setAnimationStage] = useState(0);
  // Предотвращаем повторный запуск анимации
  const animationInProgress = useRef(false);
  
  // Определяем функцию startGameTransition с использованием CSS-анимаций
  const startGameTransition = useCallback(() => {
    // Предотвращаем повторный запуск анимации
    if (animationInProgress.current) return;
    animationInProgress.current = true;
    
    console.log('[GameTransition] Запуск анимации перехода в игру');
    
    // Предзагружаем изображения и звуки перед анимацией для устранения лагов
    if (typeof window !== 'undefined') {
      const preloadImage = new window.Image();
      preloadImage.src = '/images/yin-yang-wheel.png';
    }
    
    // Запускаем анимацию с помощью CSS
    // Короткая задержка для гарантированной установки requestAnimationFrame
    requestAnimationFrame(() => {
      // Второй RAF гарантирует, что первый кадр отрисован
      requestAnimationFrame(() => {
        setAnimationStage(1);
      });
    });
    
    // Таймер для завершения анимации и вызова onComplete
    const timer = setTimeout(() => {
      console.log('[GameTransition] Анимация перехода в игру завершена');
      onComplete();
      animationInProgress.current = false;
    }, 4800); // Общее время всех анимаций
    
    // Очистка таймера при размонтировании
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  // Аналогично для перехода в меню
  const startMenuTransition = useCallback(() => {
    // Предотвращаем повторный запуск анимации
    if (animationInProgress.current) return;
    animationInProgress.current = true;
    
    console.log('[GameTransition] Запуск анимации перехода в меню');
    
    // Устанавливаем флаг для блокировки звуков во время анимации
    if (typeof window !== 'undefined') {
      window.isMenuTransitionInProgress = true;
    }
    
    // Предзагружаем изображения перед анимацией для устранения лагов
    if (typeof window !== 'undefined') {
      const preloadImage = new window.Image();
      preloadImage.src = '/images/yin-yang-wheel.png';
      
      // Предзагружаем фоновое изображение меню для более быстрого отображения
      const preloadBgImage = new window.Image();
      preloadBgImage.src = '/images/space.jpg';
    }
    
    // Устанавливаем флаг, что мы возвращаемся из игры в меню
    localStorage.setItem('returningFromGame', 'true');
    localStorage.setItem('usingTransitionAnimation', 'true');
    
    // Предварительно загружаем главную страницу
    router.prefetch('/');
    
    // Используем requestAnimationFrame для предотвращения визуальных глюков
    requestAnimationFrame(() => {
      // Создаем контейнер для анимации ворот
      const menuTransition = document.createElement('div');
      menuTransition.className = styles.menuTransition;
      document.body.appendChild(menuTransition);
      
      // Добавляем оверлей с фоном
      const overlay = document.createElement('div');
      overlay.className = styles.menuOverlay;
      menuTransition.appendChild(overlay);
      
      // Добавляем контент с анимацией колеса
      const content = document.createElement('div');
      content.className = styles.menuContent;
      menuTransition.appendChild(content);
      
      // Добавляем вращающееся колесо
      const wheel = document.createElement('img');
      wheel.src = '/images/yin-yang-wheel.png';
      wheel.className = styles.menuWheel;
      wheel.style.width = '150px';
      wheel.style.height = '150px';
      content.appendChild(wheel);
      
      // Добавляем элемент для анимации ворот
      const gates = document.createElement('div');
      gates.className = styles.menuTransitionAfter;
      menuTransition.appendChild(gates);
      
      // Задержка для завершения анимации и перехода
      const timer = setTimeout(() => {
        console.log('[GameTransition] Анимация перехода в меню завершена');
        
        // Сбрасываем флаг блокировки звуков
        if (typeof window !== 'undefined') {
          window.isMenuTransitionInProgress = false;
        }
        
        // Тихий переход без звука
        onComplete();
        
        // Через короткое время удаляем наш оверлей
        setTimeout(() => {
          try {
            document.body.removeChild(menuTransition);
          } catch (error) {
            console.log('[GameTransition] Элементы анимации уже удалены');
          }
        }, 800);
        
        animationInProgress.current = false;
      }, 1300); // Время анимации
      
      // Очистка
      return () => {
        clearTimeout(timer);
        try {
          document.body.removeChild(menuTransition);
          if (typeof window !== 'undefined') {
            window.isMenuTransitionInProgress = false;
          }
        } catch (error) {
          console.log('[GameTransition] Элементы анимации уже удалены');
        }
      };
    });
  }, [onComplete, router]);
  
  // Автоматически запускаем анимацию при монтировании компонента
  useEffect(() => {
    // Предзагрузка изображений
    const preloadBgImage = new window.Image();
    if (direction === 'toGame') {
      // Если переход в игру, загружаем бэкграунд игровой комнаты
      preloadBgImage.src = '/images/room.jpg';
    } else {
      // Если переход в меню, загружаем бэкграунд меню
      preloadBgImage.src = '/images/space.jpg';
    }
    
    if (direction === 'toGame') {
      startGameTransition();
    } else {
      startMenuTransition();
    }
  }, [direction, startGameTransition, startMenuTransition]);
  
  // Отрисовка анимации перехода в игру
  if (direction === 'toGame') {
    return (
      <div className={`${styles.gameTransition} ${animationStage >= 1 ? styles.animationStarted : ''}`}>
        <div className={styles.content}>
          <div className={styles.wheel}>
            <Image
              src="/images/yin-yang-wheel.png"
              alt="Yin-Yang Wheel"
              width={200}
              height={200}
              priority
            />
          </div>
          
          <div className={styles.curtains}>
            <div className={styles.curtainLeft}></div>
            <div className={styles.curtainRight}></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Отрисовка анимации перехода в меню
  return (
    <div className={styles.menuTransition}>
      <div className={styles.menuOverlay}></div>
      <div className={styles.menuContent}>
        <div className={styles.menuWheel}>
          <Image
            src="/images/yin-yang-wheel.png"
            alt="Yin-Yang Wheel"
            width={100}
            height={100}
            priority
          />
        </div>
      </div>
      <div className={styles.menuTransitionAfter}></div>
    </div>
  );
};

export default GameTransition; 