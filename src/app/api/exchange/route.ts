import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Используем динамический рендеринг для API

export async function POST(req: NextRequest) {
  try {
    console.log('[API exchange] Получен запрос на обмен TONOT на TON');
    
    // Подключение к базе данных
    const { db, connection } = await connectToDatabase();
    console.log('[API exchange] Подключение к БД установлено');
    
    // Получение данных из запроса
    const data = await req.json();
    const { telegramId, amount } = data;
    
    if (!telegramId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      console.error('[API exchange] Отсутствуют обязательные параметры или некорректные данные', data);
      return NextResponse.json({ 
        success: false, 
        error: 'Неверные параметры запроса' 
      }, { status: 400 });
    }
    
    console.log('[API exchange] Данные запроса:', { telegramId, amount });
    
    // Поиск пользователя
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ telegramId });
    
    if (!user) {
      console.error('[API exchange] Пользователь не найден:', telegramId);
      return NextResponse.json({ 
        success: false, 
        error: 'Пользователь не найден' 
      }, { status: 404 });
    }
    
    // Проверяем, достаточно ли у пользователя TONOT монет
    if (!user.balance || user.balance < Number(amount)) {
      console.error('[API exchange] Недостаточно TONOT для обмена:', { 
        userBalance: user.balance, 
        requestedAmount: amount 
      });
      
      return NextResponse.json({ 
        success: false, 
        error: 'Недостаточно TONOT для обмена' 
      }, { status: 400 });
    }
    
    // Константы обмена (в реальном приложении могут быть в конфигурации)
    const EXCHANGE_RATE = 1000; // 1000 TONOT = 0.00000001 TON
    
    // Рассчитываем количество TON, которое получит пользователь
    const tonAmount = Number(amount) / EXCHANGE_RATE * 0.00000001;
    
    // Обновляем баланс пользователя
    await usersCollection.updateOne(
      { telegramId },
      { 
        $set: { 
          balance: user.balance - Number(amount),
          tonBalance: (user.tonBalance || 0) + tonAmount
        } 
      }
    );
    
    console.log('[API exchange] Обмен выполнен успешно:', { 
      telegramId, 
      amount, 
      tonAmount,
      newBalance: user.balance - Number(amount),
      newTonBalance: (user.tonBalance || 0) + tonAmount
    });
    
    // Записываем операцию в историю пользователя
    try {
      // Безопасный способ получения или создания коллекции
      let userHistoryCollection;
      
      try {
        // Проверяем, существует ли коллекция истории
        const collections = await db.listCollections({ name: 'userHistory' }).toArray();
        
        if (collections.length === 0) {
          console.log('[API exchange] Коллекция userHistory не найдена, создаём новую');
          await db.createCollection('userHistory');
        }
        
        userHistoryCollection = db.collection('userHistory');
      } catch (collectionError) {
        console.error('[API exchange] Ошибка при проверке/создании коллекции:', collectionError);
        // Пробуем получить коллекцию напрямую (она может быть создана автоматически)
        userHistoryCollection = db.collection('userHistory');
      }
      
      // Создаем запись в истории
      await userHistoryCollection.insertOne({
        telegramId,
        type: 'exchange',
        date: new Date(),
        details: {
          tonot: Number(amount),
          ton: tonAmount
        }
      });
      
      console.log('[API exchange] Запись в историю пользователя создана');
    } catch (historyError) {
      console.error('[API exchange] Ошибка при создании записи в истории:', historyError);
      // Не прерываем выполнение, если запись в историю не удалась
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        balance: user.balance - Number(amount),
        tonBalance: (user.tonBalance || 0) + tonAmount,
        exchangedAmount: amount,
        receivedTon: tonAmount
      }
    });
    
  } catch (error: any) {
    console.error('[API exchange] Ошибка при обработке запроса:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
} 