import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Использование динамического рендеринга для API

export async function GET(req: NextRequest) {
  try {
    console.log('[API user-history] Получен запрос на получение истории пользователя');
    
    // Получение параметров из URL
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const type = searchParams.get('type') || null;
    
    if (!userId) {
      console.error('[API user-history] Отсутствует идентификатор пользователя');
      return NextResponse.json({ 
        success: false, 
        error: 'Идентификатор пользователя обязателен' 
      }, { status: 400 });
    }
    
    console.log('[API user-history] Параметры запроса:', { userId, page, limit, type });
    
    // Подключение к базе данных
    const { db, connection } = await connectToDatabase();
    console.log('[API user-history] Подключение к БД установлено');
    
    // Проверяем, что ID пользователя правильно преобразован
    const telegramId = typeof userId === 'string' ? userId : String(userId);
    console.log('[API user-history] Поиск пользователя с telegramId:', telegramId);
    
    // Поиск пользователя по различным форматам ID
    const usersCollection = db.collection('users');
    let user = await usersCollection.findOne({ telegramId: telegramId });
    
    // Пробуем найти по числовому ID, если пользователь не найден
    if (!user) {
      const numericId = Number(userId);
      if (!isNaN(numericId)) {
        user = await usersCollection.findOne({ telegramId: numericId });
        console.log('[API user-history] Повторная попытка поиска с числовым ID:', numericId);
      }
    }
    
    // Если пользователь все еще не найден, возвращаем пустую историю вместо ошибки
    if (!user) {
      console.warn('[API user-history] Пользователь не найден:', userId);
      return NextResponse.json({ 
        success: true, 
        data: {
          items: [],
          hasMore: false,
          totalItems: 0,
          page,
          limit
        }
      });
    }
    
    console.log('[API user-history] Пользователь найден:', user.telegramId);
    
    // Подготовка фильтров для запроса истории
    const filter: any = { telegramId: user.telegramId };
    if (type) {
      filter.type = type;
    }
    
    // Единая коллекция для всех типов истории
    let historyItems = [];
    let total = 0;
    
    try {
      // Проверяем, существует ли коллекция истории
      const collections = await db.listCollections({ name: 'userHistory' }).toArray();
      
      if (collections.length > 0) {
        const userHistoryCollection = db.collection('userHistory');
        
        // Получаем общее количество записей
        total = await userHistoryCollection.countDocuments(filter);
        
        // Получаем записи с пагинацией и сортировкой по дате (сначала новые)
        historyItems = await userHistoryCollection
          .find(filter)
          .sort({ date: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray();
        
        console.log(`[API user-history] Найдено ${historyItems.length} записей истории`);
      } else {
        console.log('[API user-history] Коллекция userHistory не существует');
        
        // Создаем коллекцию для будущего использования
        await db.createCollection('userHistory');
      }
    } catch (historyError) {
      console.error('[API user-history] Ошибка при работе с коллекцией userHistory:', historyError);
      // Продолжаем выполнение с пустым массивом записей
    }
    
    // Также получаем запросы на вывод как часть единой истории
    let withdrawItems = [];
    
    try {
      // Проверяем существование коллекции withdrawRequests
      const withdrawCollection = await db.listCollections({ name: 'withdrawRequests' }).toArray();
      
      if (withdrawCollection.length > 0 && (!type || type === 'withdraw')) {
        const withdrawRequestsCollection = db.collection('withdrawRequests');
        
        // Фильтр для запросов на вывод
        const withdrawFilter = { telegramId: user.telegramId };
        
        // Получаем запросы на вывод
        const withdrawData = await withdrawRequestsCollection
          .find(withdrawFilter)
          .sort({ createdAt: -1 })
          .toArray();
        
        // Преобразуем запросы на вывод в формат истории
        withdrawItems = withdrawData.map((item: any) => ({
          id: item._id.toString(),
          type: 'withdraw',
          date: item.createdAt,
          details: {
            amount: item.amount,
            walletAddress: item.walletAddress,
            status: item.status
          }
        }));
        
        console.log(`[API user-history] Найдено ${withdrawItems.length} запросов на вывод`);
      } else if (withdrawCollection.length === 0) {
        console.log('[API user-history] Коллекция withdrawRequests не существует');
        // Создаем коллекцию для будущего использования
        await db.createCollection('withdrawRequests');
      }
    } catch (withdrawError) {
      console.error('[API user-history] Ошибка при работе с коллекцией withdrawRequests:', withdrawError);
    }
    
    // Объединяем все элементы истории и сортируем по дате
    const allItems = [...historyItems, ...withdrawItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice((page - 1) * limit, page * limit);
    
    console.log(`[API user-history] Всего возвращено ${allItems.length} записей для пользователя ${userId}`);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        items: allItems,
        hasMore: (page * limit) < (total + withdrawItems.length),
        totalItems: total + withdrawItems.length,
        page,
        limit
      }
    });
    
  } catch (error: any) {
    console.error('[API user-history] Ошибка при обработке запроса:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 });
  }
} 