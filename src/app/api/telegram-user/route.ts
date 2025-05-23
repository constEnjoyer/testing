import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Referral from '@/models/Referral';

export const dynamic = 'force-dynamic';

/**
 * Создает или обновляет пользователя Telegram
 */
async function createTelegramUser(telegramId: string, userData: any) {
  console.log('[API telegram-user] 📝 Создание/обновление пользователя:', { telegramId });
  
  const user = await User.findOne({ telegramId });
  
  if (user) {
    console.log('[API telegram-user] ✏️ Обновление существующего пользователя');
    // Обновляем существующего пользователя
    user.firstName = userData.firstName || user.firstName;
    user.lastName = userData.lastName || user.lastName;
    user.username = userData.username || user.username;
    user.photoUrl = userData.photoUrl || user.photoUrl;
    user.chatId = userData.chatId || user.chatId;
    await user.save();
    return user;
  }

  console.log('[API telegram-user] ➕ Создание нового пользователя');
  // Создаем нового пользователя
  const newUser = await User.create({
    telegramId,
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    username: userData.username || '',
    photoUrl: userData.photoUrl || '',
    chatId: userData.chatId || '',
    referralCode: `${telegramId.slice(-5)}_${Math.random().toString(36).substring(2, 7)}`,
    tickets: 0,
    tonotChanceTickets: 0,
    balance: 0,
    tonBalance: 0,
    lastActive: new Date()
  });

  console.log('[API telegram-user] ✅ Пользователь создан:', { id: newUser.telegramId });
  return newUser;
}

/**
 * Регистрирует реферальную связь
 */
async function registerReferral(telegramId: string, startParam: string) {
  console.log('[API telegram-user] 🔄 Регистрация реферала:', { telegramId, startParam });

  // Проверяем существование реферера
  const referer = await User.findOne({ referralCode: startParam });
  if (!referer) {
    console.log('[API telegram-user] ❌ Реферер не найден:', startParam);
    throw new Error('Invalid referral code');
  }
  console.log('[API telegram-user] ✅ Найден реферер:', {
    id: referer.telegramId,
    code: startParam
  });

  // Проверяем самореферальность
  if (referer.telegramId === telegramId) {
    console.log('[API telegram-user] ❌ Попытка самореферальности:', telegramId);
    throw new Error('Cannot register your own referral code');
  }

  // Проверяем существующую связь
  const existingReferral = await Referral.findOne({
    refererId: referer.telegramId,
    referralId: telegramId
  });

  if (existingReferral) {
    console.log('[API telegram-user] ℹ️ Связь уже существует:', {
      refererId: existingReferral.refererId,
      referralId: existingReferral.referralId,
      isValid: existingReferral.isValid
    });
    return existingReferral;
  }

  // Получаем данные реферала
  const referal = await User.findOne({ telegramId });
  if (!referal) {
    console.log('[API telegram-user] ❌ Реферал не найден:', telegramId);
    throw new Error('Referral user not found');
  }

  // Создаем новую реферальную связь
  console.log('[API telegram-user] 📝 Создание новой реферальной связи');
  const newReferral = new Referral({
    refererId: referer.telegramId,
    referralId: telegramId,
    username: referal.username,
    firstName: referal.firstName,
    lastName: referal.lastName,
    photoUrl: referal.photoUrl,
    hasPlayedRoomA: false,
    hasPlayedRoomB: false,
    isValid: false,
    createdAt: new Date()
  });

  await newReferral.save();
  console.log('[API telegram-user] ✅ Реферальная связь создана:', {
    id: newReferral._id,
    refererId: newReferral.refererId,
    referralId: newReferral.referralId
  });

  // Обновляем список рефералов у реферера
  if (!referer.referrals) {
    referer.referrals = [];
  }

  referer.referrals.push({
    userId: telegramId,
    username: referal.username,
    photoUrl: referal.photoUrl,
    roomAPlayed: false,
    roomBPlayed: false,
    isValid: false
  });

  await referer.save();
  console.log('[API telegram-user] ✅ Профиль реферера обновлен:', {
    refererId: referer.telegramId,
    referralsCount: referer.referrals.length
  });

  return newReferral;
}

/**
 * Получает пользователя с информацией о рефералах
 */
async function getUserWithReferrals(telegramId: string) {
  console.log('[API telegram-user] 🔍 Получение данных пользователя с рефералами:', telegramId);
  const user = await User.findOne({ telegramId });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[API telegram-user] 📥 Начало обработки запроса');
  
  try {
    // 1. Логируем все заголовки запроса
    const headers = {
      contentType: req.headers.get('content-type'),
      userAgent: req.headers.get('user-agent'),
      referer: req.headers.get('referer')
    };
    console.log('[API telegram-user] 📋 Headers:', headers);

    // 2. Получаем и логируем URL параметры из referer
    const refererUrl = headers.referer ? new URL(headers.referer) : null;
    const startParamFromReferer = refererUrl?.searchParams.get('tgWebAppStartParam');

    console.log('[API telegram-user] 🔍 Параметры из referer:', {
      startParamFromReferer,
      fullRefererUrl: headers.referer
    });

    const body = await req.json();
    
    console.log('[API telegram-user] 📥 Тело запроса:', {
      id: body.id,
      startParam: body.startParam,
      hasStartParam: !!body.startParam
    });

    // Используем startParam из тела запроса или из referer
    const startParam = body.startParam || startParamFromReferer;
    
    // 3. Логируем полное тело запроса
    console.log('[API telegram-user] 📦 Полное тело запроса:', body);
    
    // 4. Проверяем все возможные источники startParam
    const startParamSources = {
      fromBody: body.startParam,
      fromStartParam: body.start_param,
      fromWebApp: body.tgWebAppStartParam,
      fromWebAppData: body.webAppData?.start_param,
      fromReferer: startParamFromReferer
    };
    
    console.log('[API telegram-user] 🔍 Все источники startParam:', startParamSources);
    
    // 5. Определяем итоговый startParam
    const finalStartParam = 
      startParamSources.fromBody || 
      startParamSources.fromStartParam ||
      startParamSources.fromWebApp ||
      startParamSources.fromWebAppData ||
      startParamSources.fromReferer;
    
    console.log('[API telegram-user] ✨ Итоговый startParam:', finalStartParam);

    // Поддерживаем оба формата данных
    const telegramId = body.telegramId || body.id;
    const userData = {
      firstName: body.firstName || body.first_name,
      lastName: body.lastName || body.last_name,
      username: body.username,
      chatId: body.chatId || body.telegram_chat_id
    };

    if (!telegramId) {
      console.log('[API telegram-user] ❌ Отсутствует telegramId');
      return NextResponse.json({ 
        success: false, 
        error: 'Telegram ID is required' 
      }, { status: 400 });
    }

    await connectToDatabase();
    
    // 1. Создаем/обновляем пользователя
    const user = await createTelegramUser(String(telegramId), userData);
    
    // 2. Если есть startParam, регистрируем реферала
    let referral = null;
    if (finalStartParam) {
      try {
        console.log('[API telegram-user] 🎯 Попытка регистрации реферала:', {
        telegramId,
          startParam: finalStartParam,
          userData
        });
        referral = await registerReferral(String(telegramId), finalStartParam);
      } catch (refError) {
        console.error('[API telegram-user] ❌ Ошибка при регистрации реферала:', refError);
      }
    } else {
      console.log('[API telegram-user] ℹ️ startParam отсутствует, пропускаем регистрацию реферала');
    }

    // 3. Получаем обновленные данные пользователя
    const updatedUser = await getUserWithReferrals(String(telegramId));

    console.log('[API telegram-user] ✅ Запрос обработан успешно:', {
      userId: telegramId,
      hasStartParam: !!finalStartParam,
      hasReferral: !!referral,
      referralStatus: referral ? {
        isValid: referral.isValid,
        hasPlayedRoomA: referral.hasPlayedRoomA,
        hasPlayedRoomB: referral.hasPlayedRoomB
      } : null
    });

    return NextResponse.json({
      success: true, 
      data: updatedUser,
      referral: referral
    });
  } catch (error) {
    console.error('[API telegram-user] ❌ Ошибка:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process user'
    }, { status: 500 });
  }
} 