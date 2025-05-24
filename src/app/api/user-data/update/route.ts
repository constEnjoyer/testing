import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

// Добавляем флаг для принудительного динамического рендеринга
export const dynamic = 'force-dynamic';

/**
 * POST-обработчик для обновления данных пользователя
 * @param request - Запрос с данными пользователя для обновления
 * @returns {Promise<NextResponse>} - Ответ с обновленными данными пользователя или ошибкой
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log('[API user-data/update] Получен запрос на обновление данных пользователя');
    
    // Получаем данные из тела запроса
    const userData = await request.json();
    console.log('[API user-data/update] Данные для обновления:', JSON.stringify(userData));
    
    // Проверяем наличие telegramId
    if (!userData.telegramId) {
      console.error('[API user-data/update] Отсутствует telegramId в запросе');
      return NextResponse.json(
        { success: false, error: 'Требуется поле telegramId' },
        { status: 400 }
      );
    }
    
    // Подключаемся к базе данных
    try {
      await connectToDatabase();
      console.log('[API user-data/update] Успешное подключение к базе данных');
    } catch (dbError) {
      console.error('[API user-data/update] Ошибка подключения к БД:', dbError);
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
      console.log(`[API user-data/update] Пользователь с telegramId ${telegramId} не найден, создаем нового`);
      
      // Создаем нового пользователя
      user = new User({
        telegramId,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        username: userData.username || '',
        tickets: 0,
        tonotChanceTickets: 0,
        balance: 0,
        purchaseHistory: [],
        gameHistory: []
      });
    } else {
      console.log(`[API user-data/update] Найден пользователь с telegramId ${telegramId}, обновляем данные`);
    }
    
    // Обновляем поля пользователя, если они предоставлены
    if (userData.firstName !== undefined) user.firstName = userData.firstName;
    if (userData.lastName !== undefined) user.lastName = userData.lastName;
    if (userData.username !== undefined) user.username = userData.username;
    if (userData.tickets !== undefined) user.tickets = Number(userData.tickets);
    if (userData.tonotChanceTickets !== undefined) user.tonotChanceTickets = Number(userData.tonotChanceTickets);
    if (userData.balance !== undefined) user.balance = Number(userData.balance);
    if (userData.walletAddress !== undefined) {
      // Сохраняем адрес кошелька как есть, без дополнительных проверок
      user.walletAddress = userData.walletAddress;
      console.log(`[API user-data/update] Обновлен адрес кошелька для пользователя ${telegramId}: ${userData.walletAddress}`);
    }
    if (userData.locale !== undefined) {
      if (userData.locale === 'en' || userData.locale === 'ru') {
        user.locale = userData.locale;
        console.log(`[API user-data/update] Обновлен язык пользователя на: ${userData.locale}`);
      } else {
        console.warn(`[API user-data/update] Неверный формат локали: ${userData.locale}, поддерживаются только "en" и "ru"`);
      }
    }
    
    // Если есть новая запись истории покупок, добавляем её
    if (userData.purchaseHistoryItem) {
      if (!user.purchaseHistory) user.purchaseHistory = [];
      user.purchaseHistory.push(userData.purchaseHistoryItem);
    }
    
    // Если есть новая запись истории игр, добавляем её
    if (userData.gameHistoryItem) {
      if (!user.gameHistory) user.gameHistory = [];
      user.gameHistory.push(userData.gameHistoryItem);
    }
    
    // Сохраняем изменения
    await user.save();
    console.log(`[API user-data/update] Данные пользователя с telegramId ${telegramId} успешно обновлены`);
    
    // Возвращаем обновленные данные пользователя
    return NextResponse.json({
      success: true,
      data: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        tickets: user.tickets,
        tonotChanceTickets: user.tonotChanceTickets,
        balance: user.balance,
        locale: user.locale || 'en',
        walletAddress: user.walletAddress || '',
        purchaseHistory: user.purchaseHistory,
        gameHistory: user.gameHistory
      }
    });
    
  } catch (error) {
    console.error('[API user-data/update] Ошибка при обновлении данных пользователя:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при обновлении данных пользователя', details: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    );
  }
} 