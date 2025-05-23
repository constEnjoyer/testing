import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { v4 as uuidv4 } from 'uuid';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Функция для проверки режима разработки
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

/**
 * Обработчик POST запросов на получение бонуса за рефералов
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с результатом операции
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid JSON body' 
    }, { status: 400 });
  }

  const { telegramId } = body;

  if (!telegramId) {
    return NextResponse.json({ 
      success: false, 
      error: 'Telegram ID is required' 
    }, { status: 400 });
  }

  // В режиме разработки возвращаем моковые данные
  if (isDevelopmentMode()) {
    console.log('[API referral/claim-bonus] DEV MODE: Возвращаем моковые данные для разработки');
    
    // Генерируем уникальный ID транзакции даже в DEV-режиме
    const transactionId = uuidv4();
    const transaction = {
      id: transactionId,
      amount: 1,
      type: "referral_bonus",
      timestamp: Date.now()
    };
    
    return NextResponse.json({ 
      success: true, 
      bonusClaimed: true,
      newBalance: 10, // Моковый новый баланс
      transaction
    });
  }

  try {
    await connectToDatabase();

    // Ищем пользователя по telegramId
    const user = await User.findOne({ telegramId });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    // Проверяем подписку на канал
    if (!user.channelSubscribed) {
      return NextResponse.json({ 
        success: false, 
        error: 'Channel subscription required to claim bonuses', 
        bonusClaimed: false,
        requireSubscription: true
      }, { status: 403 });
    }

    // Проверяем, есть ли доступные бонусы
    if (!user.pendingBonuses || user.pendingBonuses <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No pending bonuses available', 
        bonusClaimed: false 
      }, { status: 400 });
    }

    // Добавляем билет в баланс пользователя (используем ticketBalance вместо chanceBalance)
    user.ticketBalance = (user.ticketBalance || 0) + 1;
    
    // Обновляем статистику бонусов
    user.pendingBonuses = user.pendingBonuses - 1;
    user.bonusesReceived = (user.bonusesReceived || 0) + 1;

    // Создаем запись о транзакции в историю
    const transactionId = uuidv4();
    const transaction = {
      id: transactionId,
      amount: 1,
      type: "referral_bonus",
      timestamp: Date.now()
    };

    if (!user.purchaseHistory) {
      user.purchaseHistory = [];
    }
    
    user.purchaseHistory.push(transaction);
    
    // Сохраняем изменения
    await user.save();

    // Возвращаем информацию о полученном бонусе
    return NextResponse.json({ 
      success: true, 
      bonusClaimed: true,
      newBalance: user.ticketBalance,
      transaction
    });
  } catch (error) {
    console.error('Error claiming bonus:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to claim bonus', 
      bonusClaimed: false 
    }, { status: 500 });
  }
} 