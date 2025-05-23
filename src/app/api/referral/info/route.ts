import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Referral from '@/models/Referral';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Функция для проверки режима разработки
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

/**
 * Обработчик GET запросов на получение данных о рефералах пользователя
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с данными рефералов или ошибкой
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const telegramId = request.nextUrl.searchParams.get('telegramId');

  if (!telegramId) {
    return NextResponse.json({ 
      success: false, 
      error: 'Telegram ID is required' 
    }, { status: 400 });
  }

  // В режиме разработки возвращаем моковые данные
  if (isDevelopmentMode()) {
    console.log('[API referral/info] DEV MODE: Возвращаем моковые данные для разработки');
    return NextResponse.json({
      success: true,
      data: {
        referralCode: `${telegramId.slice(-5)}_mock`,
        referrals: [
          {
            userId: "mock_user_1",
            username: "test_user1",
            photoUrl: "https://via.placeholder.com/50",
            roomAPlayed: true,
            roomBPlayed: false,
            isValid: false
          },
          {
            userId: "mock_user_2",
            username: "test_user2",
            photoUrl: "https://via.placeholder.com/50",
            roomAPlayed: true,
            roomBPlayed: true,
            isValid: true
          }
        ],
        totalValidReferrals: 3,
        bonusesReceived: 0,
        pendingBonuses: 0,
        channelSubscribed: false
      }
    });
  }

  try {
    await connectToDatabase();

    // Ищем пользователя по telegramId
    let user = await User.findOne({ telegramId });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Получаем актуальные данные о рефералах из коллекции referrals
    const referrals = await Referral.find({ refererId: telegramId });
    
    // Формируем массив рефералов с актуальными статусами
    const referralsList = referrals.map((ref: any) => ({
      userId: ref.referralId.toString(),
      username: ref.username || '',
      photoUrl: ref.photoUrl || '',
      hasPlayedRoomA: ref.hasPlayedRoomA || false,
      hasPlayedRoomB: ref.hasPlayedRoomB || false,
      isValid: ref.isValid || false,
      roomAPlayedAt: ref.roomAPlayedAt,
      roomBPlayedAt: ref.roomBPlayedAt,
      validatedAt: ref.validatedAt
    }));

    // Формируем данные для ответа
    const referralInfo = {
      referralCode: user.referralCode,
      referrals: referralsList,
      totalValidReferrals: user.totalValidReferrals || 0,
      bonusesReceived: user.bonusesReceived || 0,
      pendingBonuses: user.pendingBonuses || 0,
      channelSubscribed: user.channelSubscribed || false
    };

    return NextResponse.json({ 
      success: true, 
      data: referralInfo
    });
  } catch (error) {
    console.error('Error fetching referral info:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch referral information' 
    }, { status: 500 });
  }
} 