import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { sendWithdrawalStatusNotification } from '@/services/telegramNotifier';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic'; // Используем динамический рендеринг для API

/**
 * API endpoint для обработки одобрения вывода средств
 * Этот эндпоинт будет вызываться Telegram-ботом после одобрения запроса администратором
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[API withdraw-approve] Получен запрос на одобрение вывода TON');
    
    // Подключение к базе данных
    const { db, connection } = await connectToDatabase();
    console.log('[API withdraw-approve] Подключение к БД установлено');
    
    // Получение данных из запроса
    const data = await req.json();
    const { requestId, status } = data;
    
    if (!requestId || !status || (status !== 'approve' && status !== 'reject')) {
      console.error('[API withdraw-approve] Отсутствуют обязательные параметры или некорректные данные', data);
      return NextResponse.json({ 
        success: false, 
        error: 'Неверные параметры запроса' 
      }, { status: 400 });
    }
    
    console.log('[API withdraw-approve] Данные запроса:', { requestId, status });
    
    // Поиск запроса на вывод
    const withdrawRequestsCollection = db.collection('withdrawRequests');
    const withdrawRequest = await withdrawRequestsCollection.findOne({ 
      _id: new ObjectId(requestId) 
    });
    
    if (!withdrawRequest) {
      console.error('[API withdraw-approve] Запрос на вывод не найден:', requestId);
      return NextResponse.json({ 
        success: false, 
        error: 'Запрос на вывод не найден' 
      }, { status: 404 });
    }
    
    console.log('[API withdraw-approve] Найден запрос на вывод:', withdrawRequest);
    
    // Обновляем статус запроса на вывод
    const newStatus = status === 'approve' ? 'approved' : 'rejected';
    await withdrawRequestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    console.log(`[API withdraw-approve] Статус запроса обновлен на: ${newStatus}`);
    
    // Отправляем уведомление пользователю о статусе вывода
    if (withdrawRequest.chatId) {
      try {
        const statusNotification = await sendWithdrawalStatusNotification(
          withdrawRequest.chatId,
          status === 'approve' ? 'completed' : 'rejected',
          withdrawRequest.amount,
          withdrawRequest.orderNumber
        );
        
        console.log('[API withdraw-approve] Результат отправки уведомления пользователю:', statusNotification);
      } catch (notificationError) {
        console.error('[API withdraw-approve] Ошибка при отправке уведомления пользователю:', notificationError);
        // Не прерываем выполнение, если отправка уведомления не удалась
      }
    }
    
    // Обновляем запись в истории пользователя
    try {
      const userHistoryCollection = db.collection('userHistory');
      
      await userHistoryCollection.updateOne(
        { 
          telegramId: withdrawRequest.telegramId,
          'details.orderNumber': withdrawRequest.orderNumber 
        },
        {
          $set: {
            'details.status': newStatus,
            'details.updatedAt': new Date().toISOString()
          }
        }
      );
      
      console.log('[API withdraw-approve] Запись в истории пользователя обновлена');
    } catch (historyError) {
      console.error('[API withdraw-approve] Ошибка при обновлении записи в истории:', historyError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Запрос на вывод ${status === 'approve' ? 'одобрен' : 'отклонен'} успешно`,
      data: {
        id: requestId,
        status: newStatus,
        updatedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[API withdraw-approve] Ошибка при обработке запроса:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
} 