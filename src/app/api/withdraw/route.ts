import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { sendWithdrawalRequestNotification } from '@/services/telegramNotifier';
import { formatTonAmount, formatDate, parseTonAmount } from '@/utils/formatUtils';

// Добавляем переменные окружения для Telegram бота в .env.local
// TELEGRAM_BOT_TOKEN=your_bot_token
// TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id

export const dynamic = 'force-dynamic'; // Используем динамический рендеринг для API

// Константы
const MIN_WITHDRAW_TON = 1e-9; // Минимальная сумма для вывода TON

export async function POST(req: NextRequest) {
  try {
    console.log('[API withdraw] Получен запрос на вывод TON');
    
    // Подключение к базе данных
    const { db, connection } = await connectToDatabase();
    console.log('[API withdraw] Подключение к БД установлено');
    
    // Получение данных из запроса
    const data = await req.json();
    const { telegramId, amount, walletAddress } = data;
    
    // Преобразуем amount в число с правильным форматированием
    const numericAmount = parseTonAmount(amount);
    
    if (!telegramId || !amount || !walletAddress || isNaN(numericAmount) || numericAmount <= 0) {
      console.error('[API withdraw] Отсутствуют обязательные параметры или некорректные данные', data);
      return NextResponse.json({ 
        success: false, 
        error: 'Неверные параметры запроса' 
      }, { status: 400 });
    }
    
    // Проверяем минимальную сумму для вывода
    if (numericAmount < MIN_WITHDRAW_TON) {
      console.error('[API withdraw] Сумма вывода меньше минимальной', {
        requestedAmount: numericAmount,
        minAmount: MIN_WITHDRAW_TON
      });
      return NextResponse.json({
        success: false,
        error: `Минимальная сумма для вывода: ${formatTonAmount(MIN_WITHDRAW_TON)} TON`
      }, { status: 400 });
    }
    
    console.log('[API withdraw] Данные запроса:', { 
      telegramId, 
      amount: numericAmount, 
      formattedAmount: formatTonAmount(numericAmount),
      walletAddress 
    });
    
    // Поиск пользователя
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ telegramId });
    
    if (!user) {
      console.error('[API withdraw] Пользователь не найден:', telegramId);
      return NextResponse.json({ 
        success: false, 
        error: 'Пользователь не найден' 
      }, { status: 404 });
    }
    
    // Проверяем, достаточно ли у пользователя TON для вывода
    const tonBalance = user.tonBalance || 0;
    
    if (tonBalance < numericAmount) {
      console.error('[API withdraw] Недостаточно TON для вывода:', { 
        tonBalance, 
        requestedAmount: numericAmount 
      });
      
      return NextResponse.json({ 
        success: false, 
        error: 'Недостаточно TON для вывода' 
      }, { status: 400 });
    }
    
    // Безопасная проверка и получение коллекции запросов на вывод
    try {
      // Проверяем, существует ли коллекция withdrawRequests
      const collections = await db.listCollections({ name: 'withdrawRequests' }).toArray();
      
      if (collections.length === 0) {
        console.log('[API withdraw] Коллекция withdrawRequests не найдена, создаём новую');
        await db.createCollection('withdrawRequests');
      }
      
      const withdrawRequestsCollection = db.collection('withdrawRequests');
      
      // Создаем объект с данными запроса
      const now = new Date();
      const withdrawRequest = {
        telegramId,
        amount: numericAmount,
        amountFormatted: formatTonAmount(numericAmount), // Сохраняем также форматированную версию
        walletAddress,
        status: 'pending',
        createdAt: now.toISOString(), // Используем ISO формат для корректного хранения даты
        createdAtFormatted: formatDate(now.toISOString()), // Форматированная дата для отображения
        notificationSent: false,
        chatId: user.chatId, // Добавляем chatId для отправки уведомлений пользователю
        orderNumber: `WD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}` // Уникальный номер ордера
      };
      
      const result = await withdrawRequestsCollection.insertOne(withdrawRequest);
      
      // Обновляем баланс пользователя (уменьшаем на сумму вывода)
      await usersCollection.updateOne(
        { telegramId },
        {
          $set: {
            tonBalance: tonBalance - numericAmount
          }
        }
      );
      
      console.log('[API withdraw] Запрос на вывод создан успешно:', {
        telegramId,
        amount: numericAmount,
        walletAddress,
        newTonBalance: tonBalance - numericAmount,
        userChatId: user.chatId || 'отсутствует'
      });
      
      // Отправляем уведомление администратору через Telegram бота
      try {
        // Отправляем уведомление
        const notificationResult = await sendWithdrawalRequestNotification(
          numericAmount,
          walletAddress,
          withdrawRequest.orderNumber
        );
        
        console.log('[API withdraw] Результат отправки уведомления:', notificationResult);
        
        // Обновляем статус отправки уведомления
        await withdrawRequestsCollection.updateOne(
          { _id: result.insertedId },
          { $set: { notificationSent: notificationResult } }
        );
        
        if (notificationResult) {
          console.log('[API withdraw] Уведомление успешно отправлено администратору');
        } else {
          console.warn('[API withdraw] Не удалось отправить уведомление администратору');
        }
      } catch (notificationError) {
        console.error('[API withdraw] Ошибка при отправке уведомления:', notificationError);
        // Не прерываем выполнение, если отправка уведомления не удалась
      }
      
      // Записываем операцию в историю пользователя
      try {
        // Проверяем, существует ли коллекция истории
        const historyCollections = await db.listCollections({ name: 'userHistory' }).toArray();
        
        if (historyCollections.length === 0) {
          console.log('[API withdraw] Коллекция userHistory не найдена, создаём новую');
          await db.createCollection('userHistory');
        }
        
        const userHistoryCollection = db.collection('userHistory');
        
        // Создаем запись в истории
        await userHistoryCollection.insertOne({
          telegramId,
          type: 'withdraw',
          date: new Date(),
          details: {
            amount: numericAmount,
            walletAddress,
            status: 'pending'
          }
        });
        
        console.log('[API withdraw] Запись в историю пользователя создана');
      } catch (historyError) {
        console.error('[API withdraw] Ошибка при создании записи в истории:', historyError);
        // Не прерываем выполнение, если запись в историю не удалась
      }
      
      return NextResponse.json({
        success: true,
        message: "Запрос на вывод создан успешно! Ожидайте обработки.",
        data: {
          id: result.insertedId,
          amount: numericAmount,
          walletAddress,
          status: 'pending',
          createdAt: new Date(),
          userChatId: user.chatId || 'отсутствует',
          orderNumber: withdrawRequest.orderNumber,
          note: user.chatId 
            ? "Мы отправим вам уведомление о статусе вывода!" 
            : "Для получения уведомлений напишите /start боту @TonotWithdrawalBot"
        }
      });
      
    } catch (error: any) {
      console.error('[API withdraw] Ошибка при создании запроса на вывод:', error);
      
      return NextResponse.json({ 
        success: false, 
        error: error.message || 'Ошибка при создании запроса на вывод' 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('[API withdraw] Ошибка при обработке запроса:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
} 