import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

/**
 * Обработчик GET запросов на получение данных пользователя
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с данными пользователя или ошибкой
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    console.log('[API user-data] 📝 Получен запрос на получение данных пользователя');
    
    // Получаем telegramId из URL
    const telegramId = req.nextUrl.searchParams.get('telegramId');
    
    if (!telegramId) {
      console.error('[API user-data] ❌ Отсутствует telegramId в запросе');
      return NextResponse.json(
        { 
          success: false, 
          error: 'telegramId обязательный параметр' 
        }, 
        { status: 400 }
      );
    }
    
    console.log('[API user-data] 🔍 Запрошены данные пользователя с telegramId:', telegramId);

    // Подключаемся к базе данных
    try {
      await connectToDatabase();
      console.log('[API user-data] ✅ Успешное подключение к базе данных');
    } catch (dbError) {
      console.error('[API user-data] ❌ Ошибка при подключении к базе данных:', dbError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ошибка при подключении к базе данных' 
        }, 
        { status: 500 }
      );
    }
    
    // Ищем пользователя в базе данных
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log('[API user-data] 📝 Пользователь не найден, создаем нового пользователя');
      
      // Если пользователь не найден, создаем нового
      user = new User({
        telegramId: String(telegramId),
        firstName: '',
        lastName: '',
        username: '',
        photoUrl: '',
        ticketBalance: 0,
        usedTickets: 0,
        bonusTickets: 0,
        referralCode: `${telegramId.slice(-5)}_${Math.random().toString(36).substring(2, 7)}`,
        referrals: [],
        totalValidReferrals: 0,
        pendingBonuses: 0,
        bonusesReceived: 0,
        channelSubscribed: false,
        tickets: 0,
        tonotChanceTickets: 0,
        balance: 0,
        tonBalance: 0
      });
      
      await user.save();
      console.log('[API user-data] ✅ Создан новый пользователь');
    }
    
    // Формируем ответ с данными пользователя
    const userData = {
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      tickets: user.tickets || 0,
      tonotChanceTickets: user.tonotChanceTickets || 0,
      balance: user.balance || 0,
      tonBalance: user.tonBalance || 0,
      referralCode: user.referralCode || '',
      referrals: user.referrals || []
    };
    
    console.log('[API user-data] ✅ Данные пользователя успешно получены');
    
    // Возвращаем данные пользователя
    return NextResponse.json({
      success: true,
      data: userData
    });
    
  } catch (error: any) {
    console.error('[API user-data] ❌ Ошибка при получении данных пользователя:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Внутренняя ошибка сервера' 
      }, 
      { status: 500 }
    );
  }
} 