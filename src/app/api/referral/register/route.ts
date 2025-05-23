import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Referral from '@/models/Referral';
import mongoose from 'mongoose';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

/**
 * Обработчик POST запросов для регистрации реферала
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с результатом регистрации
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[API referral/register] 📝 Начало обработки запроса');
  
  let body;
  try {
    body = await req.json();
    console.log('[API referral/register] 📦 Получены данные:', body);
  } catch (error) {
    console.error('[API referral/register] ❌ Ошибка парсинга JSON:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid JSON body' 
    }, { status: 400 });
  }

  const { telegramId, referralCode } = body;

  if (!telegramId || !referralCode) {
    console.error('[API referral/register] ❌ Отсутствуют обязательные параметры:', { telegramId, referralCode });
    return NextResponse.json({ 
      success: false, 
      error: 'Telegram ID and referral code are required' 
    }, { status: 400 });
  }

  try {
    // Подключаемся к базе данных
    console.log('[API referral/register] 🔄 Подключение к базе данных...');
    await connectToDatabase();
    
    // Проверяем существование коллекции referrals
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'referrals' }).toArray();
    
    if (collections.length === 0) {
      console.log('[API referral/register] 📁 Создаем коллекцию referrals');
      await db.createCollection('referrals');
    }

    // Ищем пользователя-реферера по коду
    console.log('[API referral/register] 🔍 Поиск реферера по коду:', referralCode);
    const referer = await User.findOne({ referralCode });

    if (!referer) {
      console.error('[API referral/register] ❌ Реферер не найден по коду:', referralCode);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid referral code' 
      }, { status: 404 });
    }
    console.log('[API referral/register] ✅ Реферер найден:', {
      id: referer.telegramId,
      username: referer.username
    });

    // Проверяем, что пользователь не регистрирует сам себя
    if (referer.telegramId === telegramId) {
      console.error('[API referral/register] ❌ Попытка регистрации своего кода:', telegramId);
      return NextResponse.json({ 
        success: false, 
        error: 'You cannot register your own referral code' 
      }, { status: 400 });
    }

    // Ищем пользователя-реферала
    console.log('[API referral/register] 🔍 Поиск реферала:', telegramId);
    const referal = await User.findOne({ telegramId });

    if (!referal) {
      console.error('[API referral/register] ❌ Пользователь-реферал не найден:', telegramId);
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    console.log('[API referral/register] ✅ Реферал найден:', {
      id: referal.telegramId,
      username: referal.username
    });

    // Проверяем существующую связь между этими пользователями
    console.log('[API referral/register] 🔍 Проверка существующей связи');
    const existingReferral = await Referral.findOne({ 
      refererId: referer.telegramId,
      referalId: telegramId 
    });

    if (existingReferral) {
      console.log('[API referral/register] ⚠️ Связь уже существует:', {
        refererId: existingReferral.refererId,
        referalId: existingReferral.referalId,
        createdAt: existingReferral.createdAt
      });
      return NextResponse.json({ 
        success: false, 
        error: 'This referral connection already exists' 
      }, { status: 400 });
    }

    // Проверяем, есть ли у игрока незавершенная реферальная связь
    console.log('[API referral/register] 🔍 Проверка незавершенных связей');
    const pendingReferral = await Referral.findOne({
      referalId: telegramId,
      isValid: false
    });

    if (pendingReferral) {
      console.log('[API referral/register] ⚠️ Найдена незавершенная связь:', {
        refererId: pendingReferral.refererId,
        createdAt: pendingReferral.createdAt
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Player must complete existing referral requirements first' 
      }, { status: 400 });
    }

    // Создаем новую реферальную связь
    console.log('[API referral/register] 📝 Создание новой реферальной связи');
    const newReferral = new Referral({
      refererId: referer.telegramId,
      referalId: telegramId,
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
    console.log('[API referral/register] ✅ Создана новая реферальная связь:', {
      id: newReferral._id,
      refererId: newReferral.refererId,
      referalId: newReferral.referalId
    });

    // Обновляем список рефералов у реферера
    console.log('[API referral/register] 📝 Обновление профиля реферера');
    if (!referer.referrals) {
      referer.referrals = [];
    }

    referer.referrals.push({
      userId: telegramId.toString(),
      username: referal.username,
      photoUrl: referal.photoUrl,
      roomAPlayed: false,
      roomBPlayed: false,
      isValid: false
    });

    await referer.save();
    console.log('[API referral/register] ✅ Профиль реферера обновлен:', {
      refererId: referer.telegramId,
      referralsCount: referer.referrals.length
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Referral connection successfully created',
      data: {
        refererId: referer.telegramId,
        referalId: telegramId,
        createdAt: newReferral.createdAt
      }
    });
  } catch (error) {
    console.error('[API referral/register] ❌ Ошибка при создании реферальной связи:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create referral connection'
    }, { status: 500 });
  }
} 