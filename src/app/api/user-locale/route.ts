import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { defaultLocale } from '@/core/i18n/config';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

/**
 * GET-запрос для получения языка пользователя
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[API user-locale] Получен запрос на получение языка пользователя');
    
    // Получаем telegramId из URL
    const telegramId = req.nextUrl.searchParams.get('telegramId');
    
    if (!telegramId) {
      console.error('[API user-locale] Отсутствует telegramId в запросе');
      return NextResponse.json(
        { 
          success: false, 
          error: 'telegramId обязательный параметр' 
        }, 
        { status: 400 }
      );
    }
    
    console.log('[API user-locale] Запрошен язык пользователя с telegramId:', telegramId);
    
    // Также получаем предпочтительный язык из запроса, если он есть
    const preferredLocale = req.nextUrl.searchParams.get('preferred') || null;
    console.log('[API user-locale] Предпочтительный язык из запроса:', preferredLocale);
    
    // Подключаемся к базе данных
    try {
      await connectToDatabase();
      console.log('[API user-locale] Успешное подключение к базе данных');
    } catch (dbError) {
      console.error('[API user-locale] Ошибка при подключении к базе данных:', dbError);
      
      // Если не удалось подключиться к БД, возвращаем предпочтительный язык или дефолтный
      return NextResponse.json({
        success: true,
        data: {
          telegramId,
          locale: preferredLocale || defaultLocale,
          fromLocal: true
        }
      });
    }
    
    // Ищем пользователя в базе данных
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log('[API user-locale] Пользователь не найден, возвращаем локаль:', preferredLocale || defaultLocale);
      
      // Если пользователь не найден, возвращаем предпочтительный язык или дефолтный
      return NextResponse.json({
        success: true,
        data: {
          telegramId,
          locale: preferredLocale || defaultLocale,
          isDefault: true
        }
      });
    }
    
    console.log('[API user-locale] Пользователь найден, локаль:', user.locale || defaultLocale);
    
    // Возвращаем локаль пользователя или дефолтную
    return NextResponse.json({
      success: true,
      data: {
        telegramId: user.telegramId,
        locale: user.locale || defaultLocale
      }
    });
    
  } catch (error: any) {
    console.error('[API user-locale] Ошибка при получении языка пользователя:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Внутренняя ошибка сервера' 
      }, 
      { status: 500 }
    );
  }
}

/**
 * POST-запрос для обновления языка пользователя
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log('[API user-locale] Получен запрос на обновление языка пользователя');
    
    // Получаем данные из тела запроса
    const userData = await request.json();
    console.log('[API user-locale] Данные для обновления:', JSON.stringify(userData));
    
    // Проверяем наличие telegramId и locale
    if (!userData.telegramId || !userData.locale) {
      console.error('[API user-locale] Отсутствуют обязательные поля в запросе');
      return NextResponse.json(
        { success: false, error: 'Требуются поля telegramId и locale' },
        { status: 400 }
      );
    }
    
    // Проверяем валидность locale
    if (!['ru', 'en'].includes(userData.locale)) {
      console.error('[API user-locale] Неверное значение locale:', userData.locale);
      return NextResponse.json(
        { success: false, error: 'Неверное значение locale, поддерживаются только "ru" и "en"' },
        { status: 400 }
      );
    }
    
    // Подключаемся к базе данных
    try {
      await connectToDatabase();
      console.log('[API user-locale] Успешное подключение к базе данных');
    } catch (dbError) {
      console.error('[API user-locale] Ошибка подключения к БД:', dbError);
      return NextResponse.json(
        { success: false, error: 'Ошибка подключения к базе данных', details: dbError instanceof Error ? dbError.message : 'Неизвестная ошибка' },
        { status: 500 }
      );
    }
    
    // Преобразуем telegramId в число
    const telegramId = Number(userData.telegramId);
    
    // Ищем пользователя в базе данных
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log(`[API user-locale] Пользователь с telegramId ${telegramId} не найден, создаем нового`);
      
      // Создаем нового пользователя с указанной локалью
      user = new User({
        telegramId,
        firstName: '',
        lastName: '',
        username: '',
        tickets: 0,
        tonotChanceTickets: 0,
        balance: 0,
        locale: userData.locale
      });
    } else {
      console.log(`[API user-locale] Найден пользователь с telegramId ${telegramId}, обновляем локаль на ${userData.locale}`);
      
      // Обновляем локаль пользователя
      user.locale = userData.locale;
    }
    
    // Сохраняем изменения
    await user.save();
    console.log(`[API user-locale] Локаль пользователя с telegramId ${telegramId} обновлена на ${userData.locale}`);
    
    // Возвращаем обновленные данные
    return NextResponse.json({
      success: true,
      data: {
        telegramId: user.telegramId,
        locale: user.locale
      }
    });
    
  } catch (error) {
    console.error('[API user-locale] Ошибка при обновлении языка пользователя:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении языка пользователя', details: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    );
  }
} 