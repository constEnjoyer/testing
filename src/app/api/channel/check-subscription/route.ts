import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

// Функция для проверки режима разработки
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

/**
 * Обработчик GET запросов на проверку подписки на канал
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с информацией о статусе подписки
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const telegramId = req.nextUrl.searchParams.get('telegramId');

  if (!telegramId) {
    return NextResponse.json({ 
      success: false, 
      error: 'Telegram ID is required' 
    }, { status: 400 });
  }

  // В режиме разработки возвращаем моковые данные
  if (isDevelopmentMode()) {
    console.log('[API channel/check-subscription] DEV MODE: Возвращаем моковые данные для разработки');
    
    // В DEV режиме всегда возвращаем, что пользователь подписан
    return NextResponse.json({ 
      success: true, 
      data: {
        isSubscribed: true,
        updated: false
      }
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

    // Возвращаем текущее значение из базы
    return NextResponse.json({ 
      success: true, 
      data: {
        isSubscribed: user.channelSubscribed || false,
        updated: false
      }
    });
  } catch (error) {
    console.error('Error checking channel subscription:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check channel subscription' 
    }, { status: 500 });
  }
}

/**
 * Обработчик POST запросов на обновление статуса подписки на канал
 * @param {NextRequest} req - Объект запроса
 * @returns {Promise<NextResponse>} - Ответ с результатом обновления статуса
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { telegramId } = body;
    
    if (!telegramId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Telegram ID is required' 
      }, { status: 400 });
    }

    // В режиме разработки возвращаем моковые данные
    if (isDevelopmentMode()) {
      console.log('[API channel/check-subscription POST] DEV MODE: Имитируем успешную подписку');
      
      return NextResponse.json({ 
        success: true, 
        data: {
          isSubscribed: true,
          updated: true
        }
      });
    }

    await connectToDatabase();

    // Получаем текущего пользователя
    const user = await User.findOne({ telegramId });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Обновляем статус подписки
    const wasSubscribed = user.channelSubscribed || false;
    user.channelSubscribed = true;
    await user.save();

    return NextResponse.json({ 
      success: true, 
      data: {
        isSubscribed: true,
        updated: !wasSubscribed // true если статус был изменен
      }
    });
  } catch (error) {
    console.error('Error updating channel subscription:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update channel subscription' 
    }, { status: 500 });
  }
} 