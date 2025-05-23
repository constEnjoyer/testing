import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import telegramNotifier, { handleTelegramCallback, updateAdminRequestMessage, sendWithdrawalStatusNotification } from '@/services/telegramNotifier';
import TelegramBot from 'node-telegram-bot-api';

export const dynamic = 'force-dynamic'; // Используем динамический рендеринг для API

// Функция для настройки вебхука
async function setupWebhook(webhookUrl: string) {
  try {
    if (!telegramNotifier.bot) {
      return { ok: false, error: 'Telegram бот не настроен' };
    }
    
    const result = await telegramNotifier.bot.setWebHook(webhookUrl);
    return { ok: result, webhookUrl };
  } catch (error: any) {
    console.error('Ошибка при настройке вебхука:', error);
    return { ok: false, error: error.message || 'Ошибка при настройке вебхука' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Telegram Webhook] Получен запрос:", JSON.stringify(body));

    if (body.message) {
      const { message } = body;
      
      // Обработка команды /start - сохраняем chatId пользователя
      if (message.text && message.text.toLowerCase() === '/start') {
        const db = await connectToDatabase();
        const usersCollection = db.db.collection('users');
        
        // Проверяем, существует ли пользователь
        const user = await usersCollection.findOne({ telegramId: message.from.id.toString() });
        
        if (user) {
          // Обновляем chatId пользователя
          await usersCollection.updateOne(
            { telegramId: message.from.id.toString() },
            { $set: { chatId: message.chat.id.toString() } }
          );
          console.log(`[Telegram Webhook] Обновлен chatId для пользователя ${message.from.id}: ${message.chat.id}`);
        }
        
        // Отправляем приветственное сообщение с уже настроенным ботом
        if (!telegramNotifier.bot) {
          console.error("[Telegram Webhook] Бот не настроен");
          return NextResponse.json({ ok: false, error: "Бот не настроен" });
        }

        await telegramNotifier.bot.sendMessage(
          message.chat.id, 
          `👋 Привет! Теперь вы будете получать уведомления о выводе средств.`
        );
        
        return NextResponse.json({ ok: true });
      }
    }
    
    // Проверяем, что это запрос от Telegram бота и содержит колбэк от кнопки
    if (!body || !body.callback_query) {
      // Возможно это другой тип вебхука (не колбэк от кнопки), просто возвращаем успех
      console.log('[Telegram Webhook] Получен не callback запрос');
      return NextResponse.json({ ok: true });
    }
    
    console.log('[Telegram Webhook] Получен колбэк:', JSON.stringify(body.callback_query));
    
    const { callback_query } = body;
    
    // Получаем необходимые данные
    const { data: callbackData, message: callbackMessage, id: callback_id } = callback_query;
    
    if (!callbackData || !callbackMessage) {
      console.error('[Telegram Webhook] Некорректные данные колбэка');
      return NextResponse.json({ ok: false, error: 'Некорректные данные колбэка' });
    }
    
    // Вызываем обработчик колбэка из telegramNotifier, который ответит на callback query
    const callbackHandled = await handleTelegramCallback(callback_query);
    console.log('[Telegram Webhook] Результат обработки колбэка:', callbackHandled);
    
    // Если handleTelegramCallback не смог обработать запрос, возвращаем ошибку
    if (!callbackHandled) {
      console.error('[Telegram Webhook] Не удалось обработать callback запрос');
      return NextResponse.json({ ok: false, error: 'Ошибка обработки callback запроса' });
    }
    
    // Парсим данные колбэка (approve_ID или reject_ID)
    const [action, requestId] = callbackData.split('_');
    
    if (!action || !requestId || (action !== 'approve' && action !== 'reject')) {
      console.error('[Telegram Webhook] Некорректный формат данных колбэка:', callbackData);
      return NextResponse.json({ ok: false, error: 'Некорректный формат данных колбэка' });
    }
    
    // Определяем статус на основе действия
    const status = action === 'approve' ? 'completed' : 'rejected';
    
    // Подключаемся к базе данных
    const { db } = await connectToDatabase();
    const withdrawRequestsCollection = db.collection('withdrawRequests');
    
    // Ищем запрос на вывод по orderNumber вместо ObjectId
    const withdrawRequest = await withdrawRequestsCollection.findOne({ orderNumber: requestId });

    if (!withdrawRequest) {
      console.error('[Telegram Webhook] Запрос на вывод не найден:', requestId);
      
      await telegramNotifier.bot?.answerCallbackQuery(callback_id, {
        text: 'Ошибка: запрос на вывод не найден',
        show_alert: true
      });
      
      return NextResponse.json({ ok: false, error: 'Запрос на вывод не найден' });
    }
    
    // Проверяем, что запрос еще не обработан
    if (withdrawRequest.status !== 'pending') {
      console.error(`[Telegram Webhook] Запрос на вывод с ID ${requestId} уже обработан (статус: ${withdrawRequest.status})`);
      
      // Обновляем сообщение с ошибкой
      await updateAdminRequestMessage(
        callbackMessage.chat.id,
        callbackMessage.message_id,
        callbackMessage.text,
        status,
        `Запрос уже обработан ранее (статус: ${withdrawRequest.status})`
      );
      
      return NextResponse.json({ ok: false, error: 'Запрос на вывод уже обработан' });
    }
    
    // Обновляем статус запроса
    await withdrawRequestsCollection.updateOne(
      { orderNumber: requestId },
      { 
        $set: { 
          status, 
          updatedAt: new Date().toISOString() 
        } 
      }
    );
    
    console.log(`[Telegram Webhook] Статус запроса на вывод ${requestId} обновлен на ${status}`);
    
    // Получаем коллекцию пользователей
    const usersCollection = db.collection('users');
    
    // Получаем пользователя
    const user = await usersCollection.findOne({ telegramId: withdrawRequest.telegramId });
    
    if (user) {
      if (status === 'rejected') {
        // Если запрос отклонен, возвращаем средства пользователю
        await usersCollection.updateOne(
          { telegramId: withdrawRequest.telegramId },
          { 
            $set: { 
              tonBalance: (user.tonBalance || 0) + withdrawRequest.amount,
              pendingWithdrawals: Math.max(0, (user.pendingWithdrawals || 0) - withdrawRequest.amount)
            } 
          }
        );
        
        console.log(`[Telegram Webhook] Средства возвращены пользователю ${withdrawRequest.telegramId}: ${withdrawRequest.amount} TON`);
      } else if (status === 'completed') {
        // Если запрос одобрен, обновляем pendingWithdrawals (TON уже был списан при создании запроса)
        await usersCollection.updateOne(
          { telegramId: withdrawRequest.telegramId },
          { 
            $set: { 
              pendingWithdrawals: Math.max(0, (user.pendingWithdrawals || 0) - withdrawRequest.amount)
            } 
          }
        );
        
        console.log(`[Telegram Webhook] Обновлены pendingWithdrawals для пользователя ${withdrawRequest.telegramId}: -${withdrawRequest.amount} TON`);
      }
    }
    
    // Обновляем сообщение администратора
    await updateAdminRequestMessage(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      callbackMessage.text,
      status
    );
    
    // Отправляем уведомление пользователю
    if (withdrawRequest.chatId) {
      console.log(`[Telegram Webhook] Отправка уведомления на chatId: "${withdrawRequest.chatId}", тип: ${typeof withdrawRequest.chatId}`);
      try {
        await sendWithdrawalStatusNotification(
          withdrawRequest.chatId,
          status,
          withdrawRequest.amount,
          withdrawRequest.orderNumber // Передаем номер ордера
        );
        console.log(`[Telegram Webhook] Уведомление отправлено пользователю ${withdrawRequest.telegramId}`);
      } catch (notifyError) {
        console.error(`[Telegram Webhook] Ошибка при отправке уведомления:`, notifyError);
      }
    } else {
      console.warn(`[Telegram Webhook] Не удалось отправить уведомление пользователю, отсутствует chatId`);
      
      // Пробуем получить chatId из модели пользователя
      try {
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ telegramId: withdrawRequest.telegramId });
        
        if (user && user.chatId) {
          await sendWithdrawalStatusNotification(
            user.chatId,
            status,
            withdrawRequest.amount,
            withdrawRequest.orderNumber // Передаем номер ордера
          );
          console.log(`[Telegram Webhook] Уведомление отправлено пользователю ${withdrawRequest.telegramId} после дополнительного поиска chatId`);
        } else {
          console.error(`[Telegram Webhook] Не удалось найти chatId пользователя ${withdrawRequest.telegramId}`);
        }
      } catch (error) {
        console.error(`[Telegram Webhook] Ошибка при поиске chatId пользователя:`, error);
      }
    }
    
    // Обновляем запись в истории пользователя
    try {
      const userHistoryCollection = db.collection('userHistory');
      
      // Ищем запись в истории
      const historyItem = await userHistoryCollection.findOne({
        telegramId: withdrawRequest.telegramId,
        'details.walletAddress': withdrawRequest.walletAddress,
        type: 'withdraw'
      });
      
      if (historyItem) {
        // Обновляем запись в истории
        await userHistoryCollection.updateOne(
          { _id: historyItem._id },
          { 
            $set: { 
              'details.status': status 
            } 
          }
        );
        
        console.log(`[Telegram Webhook] Обновлена запись в истории пользователя ${withdrawRequest.telegramId}`);
      }
    } catch (historyError) {
      console.error('[Telegram Webhook] Ошибка при обновлении истории:', historyError);
      // Не прерываем выполнение, если обновление истории не удалось
    }
    
    return NextResponse.json({ ok: true, status });
    
  } catch (error: any) {
    console.error('[Telegram Webhook] Ошибка при обработке вебхука:', error);
    
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
}

// Эндпоинт для проверки работоспособности вебхука и его настройки
export async function GET(req: NextRequest) {
  // Получаем URL для вебхука из окружения или из URL приложения
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || 
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram-webhook`;
  
  // Определяем, запрашивается ли настройка вебхука
  const setupRequested = req.nextUrl.searchParams.get('setup') === 'true';
  
  let webhookStatus: any = { configured: false };
  
  // Если запрошена настройка вебхука и мы в продакшене, настраиваем вебхук
  if (setupRequested && process.env.NODE_ENV === 'production') {
    webhookStatus = await setupWebhook(webhookUrl);
    console.log(`Результат настройки вебхука: ${JSON.stringify(webhookStatus)}`);
  }
  
  return NextResponse.json({ 
    ok: true, 
    message: 'Telegram webhook API is ready',
    bot_configured: telegramNotifier.isConfigured,
    webhook_url: webhookUrl,
    webhook_status: webhookStatus
  });
} 