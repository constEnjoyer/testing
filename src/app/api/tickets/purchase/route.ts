import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';
/**
 * POST-обработчик для сохранения информации о покупке билетов
 * @param request - Запрос
 * @returns {Promise<NextResponse>} - Ответ с результатом операции
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log('[API tickets/purchase] Получен запрос на сохранение покупки билетов');

    // Получаем данные из тела запроса
    const purchaseData = await request.json();
    console.log('[API tickets/purchase] Полученные данные:', JSON.stringify(purchaseData));
    console.log('[API tickets/purchase] Типы данных: tickets =', typeof purchaseData.tickets, 'amount =', typeof purchaseData.amount);

    // Проверяем наличие обязательных полей
    if (!purchaseData.telegramId || !purchaseData.amount || !purchaseData.tickets || !purchaseData.transactionHash) {
      console.error('[API tickets/purchase] Отсутствуют обязательные поля в запросе:', JSON.stringify(purchaseData));
      return NextResponse.json(
        { success: false, error: 'Требуются поля telegramId, amount, tickets и transactionHash' },
        { status: 400 }
      );
    }

    // Преобразуем данные в нужные типы
    const telegramId = Number(purchaseData.telegramId);
    const amount = Number(purchaseData.amount);
    // Важно: убедимся, что билеты всегда целые числа
    const tickets = Math.round(Number(purchaseData.tickets));
    const transactionHash = String(purchaseData.transactionHash);

    console.log(`[API tickets/purchase] Обработанные данные покупки: telegramId=${telegramId}, билетов=${tickets} (тип: ${typeof tickets}), хеш=${transactionHash}`);

    // Подключаемся к базе данных
    console.log('[API tickets/purchase] Попытка подключения к базе данных...');
    let db;
    try {
      const dbConnection = await connectToDatabase();
      db = dbConnection.db;
      console.log('[API tickets/purchase] Успешное подключение к базе данных');
    } catch (dbConnectError) {
      console.error('[API tickets/purchase] Ошибка подключения к базе данных:', dbConnectError);
      return NextResponse.json(
        { success: false, error: 'Ошибка подключения к базе данных', details: dbConnectError instanceof Error ? dbConnectError.message : 'Неизвестная ошибка' },
        { status: 500 }
      );
    }

    // Проверяем, что модель User доступна
    console.log('[API tickets/purchase] Модель User доступна:', !!User);
    console.log('[API tickets/purchase] Тип модели User:', typeof User);
    console.log('[API tickets/purchase] Модель использует коллекцию:', User.collection?.name || 'Неизвестно');

    try {
      // Ищем пользователя в базе данных
      console.log(`[API tickets/purchase] Поиск пользователя с telegramId: ${telegramId}`);
      let user = await User.findOne({ telegramId });
      console.log(`[API tickets/purchase] Результат поиска пользователя:`, user ? 'Найден' : 'Не найден');

      // Если пользователь не найден, создаем нового
      if (!user) {
        console.log(`[API tickets/purchase] Пользователь с telegramId ${telegramId} не найден, создаю нового`);
        user = new User({
          telegramId,
          firstName: 'Новый пользователь', // Временное значение
          balance: 0,
          tickets, // Используем округленное целое число
          purchaseHistory: [{
            date: new Date(),
            amount,
            tickets, // Используем округленное целое число
            transactionId: transactionHash
          }]
        });

        try {
          console.log('[API tickets/purchase] Попытка сохранения нового пользователя:', JSON.stringify(user.toObject ? user.toObject() : user));
          await user.save();
          console.log(`[API tickets/purchase] Новый пользователь успешно создан! ID:`, user._id);
        } catch (saveError) {
          console.error(`[API tickets/purchase] Ошибка при сохранении нового пользователя:`, saveError);
          return NextResponse.json(
            { success: false, error: 'Ошибка при сохранении нового пользователя', details: saveError instanceof Error ? saveError.message : 'Неизвестная ошибка' },
            { status: 500 }
          );
        }
      } else {
        // Обновляем существующего пользователя
        console.log('[API tickets/purchase] Обновление существующего пользователя', user._id);

        // Добавляем запись в историю покупок
        user.purchaseHistory.push({
          date: new Date(),
          amount,
          tickets, // Используем округленное целое число
          transactionId: transactionHash
        });

        // Обновляем количество билетов, убедившись, что они целые числа
        user.tickets = Math.round((user.tickets || 0) + tickets);

        // Сохраняем изменения
        console.log('[API tickets/purchase] Сохранение обновленного пользователя:', user._id, 'новое количество билетов:', user.tickets);
        await user.save();
        console.log('[API tickets/purchase] Пользователь успешно обновлен!');
      }

      // Добавляем запись в общую коллекцию истории пользователя (userHistory)
      try {
        // Проверяем существование коллекции userHistory
        console.log('[API tickets/purchase] Запись операции в общую историю пользователя');
        
        // Безопасно получаем коллекцию истории
        let userHistoryCollection;
        
        try {
          // Проверяем, существует ли коллекция userHistory
          const collections = await db.listCollections({ name: 'userHistory' }).toArray();
          
          if (collections.length === 0) {
            console.log('[API tickets/purchase] Коллекция userHistory не найдена, создаём новую');
            await db.createCollection('userHistory');
          }
          
          userHistoryCollection = db.collection('userHistory');
        } catch (collectionError) {
          console.error('[API tickets/purchase] Ошибка при проверке/создании коллекции:', collectionError);
          // Пробуем получить коллекцию напрямую (она может быть создана автоматически)
          userHistoryCollection = db.collection('userHistory');
        }
        
        // Создаем запись в истории
        await userHistoryCollection.insertOne({
          telegramId,
          type: 'ticket_purchase',
          date: new Date(),
          details: {
            amount: amount,
            tickets: tickets,
            transactionHash: transactionHash
          }
        });
        
        console.log('[API tickets/purchase] Запись в историю пользователя успешно создана');
      } catch (historyError) {
        console.error('[API tickets/purchase] Ошибка при создании записи в истории:', historyError);
        // Не прерываем выполнение, если запись в историю не удалась
      }

      // Возвращаем успешный ответ
      return NextResponse.json({
        success: true,
        data: {
          telegramId,
          tickets: user.tickets,
          transactionId: transactionHash
        }
      });
    } catch (error) {
      console.error('[API tickets/purchase] Ошибка при обработке запроса:', error);
      return NextResponse.json(
        { success: false, error: 'Ошибка при обработке запроса', details: error instanceof Error ? error.message : 'Неизвестная ошибка' },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error('[API tickets/purchase] Непредвиденная ошибка:', e);
    return NextResponse.json(
      { success: false, error: 'Непредвиденная ошибка сервера', details: e instanceof Error ? e.message : 'Неизвестная ошибка' },
      { status: 500 }
    );
  }
}
