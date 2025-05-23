//use server is required
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { defaultLocale } from "./config";
import type { Locale } from "./types";
import { 
  getFromLocalStorage,
  saveToLocalStorage,
  STORAGE_KEYS 
} from '@/utils/storageUtils';

// In this example the locale is read from a cookie. You could alternatively
// also read it from a database, backend service, or any other source.
const COOKIE_NAME = "NEXT_LOCALE";

const getLocale = async () => {
  return cookies().get(COOKIE_NAME)?.value || defaultLocale;
};

const setLocale = async (locale?: string) => {
  try {
    // Валидация локали
    const validLocale = locale && ['en', 'ru'].includes(locale) ? locale : defaultLocale;
    
    // Серверная часть - устанавливаем куки с увеличенным сроком действия
    cookies().set(COOKIE_NAME, validLocale as Locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 год
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Выполняем только на клиенте
    if (typeof window !== 'undefined' && validLocale) {
      // Проверяем текущую локаль в localStorage
      const currentLocale = getFromLocalStorage(STORAGE_KEYS.APP_LOCALE, null);
      
      // Только если локаль отличается, обновляем её
      if (currentLocale !== validLocale) {
        // Сохраняем локаль в localStorage для синхронизации
        saveToLocalStorage(STORAGE_KEYS.APP_LOCALE, validLocale);
        console.log('[locale] Сохранено в localStorage:', validLocale);
        
        // Также устанавливаем cookie на клиенте для дублирования
        document.cookie = `${COOKIE_NAME}=${validLocale}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
        console.log('[locale] Установлена cookie на клиенте:', validLocale);
        
        // Сохраняем локаль на сервере через API для авторизованных пользователей
        const telegramId = getFromLocalStorage(STORAGE_KEYS.TELEGRAM_USER_ID, null);
        if (telegramId) {
          console.log('[locale] Найден telegramId, сохраняем локаль на сервере:', telegramId, validLocale);
          try {
            fetch('/api/user-locale', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                telegramId: telegramId,
                locale: validLocale
              }),
            }).then(response => {
              if (response.ok) {
                console.log('[locale] Локаль успешно сохранена на сервере');
              } else {
                console.error('[locale] Ошибка при сохранении локали на сервере');
              }
            });
          } catch (apiError) {
            console.error('[locale] Ошибка API при сохранении локали:', apiError);
          }
        }
        
        // Создаем и отправляем кастомное событие для оповещения всех компонентов
        const event = new CustomEvent('app-locale-changed', { detail: { locale: validLocale } });
        window.dispatchEvent(event);
      }
      
      // Код для управления URL и переходами страниц
      // Сохраняем текущий URL и параметры
      const url = new URL(window.location.href);
      const currentPath = url.pathname;
      const currentSearch = url.search;
      const isGameRoom = currentPath.includes('/game-room');
      
      // Если текущая страница - игровая комната, обрабатываем особым образом
      if (isGameRoom) {
        console.log('[locale] Особая обработка для игровой комнаты');
        
        // Не меняем URL для игровой комнаты вообще
        // В этом проекте маршрут с префиксом локали не поддерживается
        return;
      }
      
      // Формируем новый URL с параметром локали только для обычных страниц
      // Анализируем текущий путь
      const pathSegments = currentPath.split('/').filter(Boolean);
      const isLocaleSegment = ['en', 'ru'].includes(pathSegments[0]);
      
      let newPath;
      if (isLocaleSegment) {
        // Если первый сегмент - это локаль, заменяем его
        pathSegments[0] = validLocale;
        newPath = '/' + pathSegments.join('/');
      } else {
        // Иначе добавляем локаль в начало пути
        newPath = `/${validLocale}${currentPath === '/' ? '' : currentPath}`;
      }
      
      const nextUrl = `${newPath}${currentSearch}`;
      console.log('[locale] Новый URL:', nextUrl);
      
      // Для других страниц выполняем стандартную обработку
      if (process.env.NODE_ENV === 'production') {
        // В production меняем URL с перезагрузкой
        window.location.href = nextUrl;
      } else {
        // В development только меняем URL без перезагрузки
        window.history.pushState(null, '', nextUrl);
      }
    }
  } catch (error) {
    console.error('[locale] Ошибка при установке локали:', error);
  }
};

export { getLocale, setLocale };
