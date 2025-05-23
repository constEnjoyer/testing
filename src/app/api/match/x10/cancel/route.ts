import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import WaitingPlayerX10 from '@/models/WaitingPlayerX10';
import User from '@/models/User';
import { X10ApiResponse } from '@/@types/x10';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Вспомогательные функции для API ответов
const createErrorResponse = (error: string, status: number = 500): NextResponse => {
  return NextResponse.json({ success: false, error }, { status });
};

const createSuccessResponse = (data: any): NextResponse => {
  return NextResponse.json({ success: true, ...data });
};

export async function POST(req: Request): Promise<NextResponse> {
  const session = await mongoose.startSession();
  
  try {
    await connectToDatabase();
    session.startTransaction();
    
    const body = await req.json();
    const { telegramId } = body;

    if (!telegramId) {
      return createErrorResponse('Не указан telegramId', 400);
    }

    console.log('[X10] Checking cancel possibility for user:', telegramId);
    
    // Получаем статус игрока
    const waitingPlayer = await WaitingPlayerX10.findOne({ telegramId });
    
    // Если игрок не в очереди
    if (!waitingPlayer) {
      return createSuccessResponse({
        message: 'Игрок не находится в очереди',
        canRefund: false
      });
    }

    // Проверяем время в очереди
    const timeInQueue = Date.now() - waitingPlayer.joinedAt.getTime();
    const canRefund = timeInQueue >= 60 * 60 * 1000; // 1 час

    if (!canRefund) {
      return createSuccessResponse({
        message: 'Невозможно отменить игру до истечения 1 часа',
        timeInQueue,
        canRefund: false
      });
    }

    // Удаляем из очереди и возвращаем билет
    await WaitingPlayerX10.findOneAndDelete({ telegramId }, { session });

    // Возвращаем билет пользователю
    await User.findOneAndUpdate(
      { telegramId },
      { $inc: { 'balance.chance': 1 } },
      { session }
    );

    await session.commitTransaction();

    return createSuccessResponse({
      message: 'Поиск отменен, билет возвращен',
      refunded: true
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('[X10] Cancel error:', error);
    return createErrorResponse('Ошибка при обработке запроса', 500);
  } finally {
    session.endSession();
  }
}

// Удаляем GET эндпоинт, так как очистка теперь в моделях 