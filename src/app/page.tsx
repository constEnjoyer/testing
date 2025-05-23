'use client';

import { useState, useEffect } from 'react';
import { GameMenu } from '@/components/GameMenu/GameMenu';
import { IntroScreen } from '@/components/IntroScreen/IntroScreen';
import AgeVerificationModal from '@/components/AgeVerificationModal/AgeVerificationModal';
import styles from '@/components/GameMenu/components/MenuAnimation.module.css';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from 'next/navigation';
import { useLaunchParams } from '@telegram-apps/sdk-react';

export default function Home() {
  const { user } = useUser();
  const router = useRouter();
  
  // Получаем только необходимые параметры из launch, startParam будет обрабатываться в /api/telegram-user
  const launch = useLaunchParams();

  // Состояние для отслеживания показа интро
  const [showIntro, setShowIntro] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [isWebAppReady, setIsWebAppReady] = useState(false);

  useEffect(() => {
    const checkWebAppReady = () => {
      const isReady = window?.Telegram?.WebApp?.isInitialized;
      if (isReady && !isWebAppReady) {
        setIsWebAppReady(true);
        console.log('[page] 🚀 Telegram WebApp готов');
      }
      return isReady;
    };

    // Проверяем сразу
    checkWebAppReady();

    // Добавляем обработчик события ready
    const handleWebAppReady = () => {
      console.log('[page] 🚀 Telegram WebApp готов');
      setIsWebAppReady(true);
    };

    window.Telegram?.WebApp?.onEvent('ready', handleWebAppReady);

    return () => {
      window.Telegram?.WebApp?.offEvent('ready', handleWebAppReady);
    };
  }, [isWebAppReady]);

  useEffect(() => {
    // Проверяем, возвращаемся ли мы из игровой комнаты
    const isReturningFromGame = localStorage.getItem('returningFromGame');
    // Проверяем флаг, который устанавливается при использовании анимации
    const usingTransitionAnimation = localStorage.getItem('usingTransitionAnimation');
    
    // Если возвращаемся из игры, пропускаем проверку возраста
    if (isReturningFromGame) {
      setIsAgeVerified(true); // Автоматически подтверждаем возраст
      setMenuVisible(true);
      // Очищаем флаги возврата из игры
      localStorage.removeItem('returningFromGame');
      if (usingTransitionAnimation) {
        localStorage.removeItem('usingTransitionAnimation');
      }
      return;
    }

    // Проверяем, является ли это навигацией назад
    const isNavigatingBack = performance?.navigation?.type === 2 || 
      (window.performance && 
       (window.performance.getEntriesByType('navigation')[0] as any)?.type === 'back_forward');
    
    if (isNavigatingBack) {
      setIsAgeVerified(true); // Пропускаем проверку возраста при навигации назад
      setMenuVisible(true);
    } else {
      setShowIntro(true);
    }
  }, [isWebAppReady]);
  
  // Функция для завершения показа интро
  const handleIntroComplete = () => {
    setShowIntro(false);
    setTimeout(() => {
      setMenuVisible(true);
    }, 100);
  };

  const handleAgeConfirm = () => {
    setIsAgeVerified(true);
    console.log('[page] Возраст подтвержден, показываем интро');
  };

  // Показываем проверку возраста только при первом входе
  if (!isAgeVerified) {
    return (
      <AgeVerificationModal
        onConfirm={handleAgeConfirm}
      />
    );
  }

  // После подтверждения возраста показываем обычный контент
  return (
    <>
      {showIntro ? (
        <IntroScreen onComplete={handleIntroComplete} />
      ) : (
        <div className={`${styles.container} ${menuVisible ? styles.visible : ''}`}>
          <GameMenu />
        </div>
      )}
    </>
  );
}