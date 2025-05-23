import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import Match from '@/models/Match';
import { v4 as uuidv4 } from 'uuid';

// Принудительный динамический рендеринг
export const dynamic = 'force-dynamic';

/**
 * POST-обработчик для создания нового матча
 * @param request - Запрос
 * @returns {Promise<NextResponse>} - Ответ с данными созданного матча или ошибкой
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    console.log('[API match/create] Получен запрос на создание матча');

    // Получаем данные из тела запроса
    const matchData = await request.json();
    console.log('[API match/create] Данные матча:', JSON.stringify(matchData));

    // Проверяем наличие обязательных полей
    if (!matchData.player1Id || !matchData.player2Id || !matchData.ticketsAmount) {
      console.error('[API match/create] Отсутствуют обязательные поля в запросе:', JSON.stringify(matchData));
      return NextResponse.json(
        { success: false, error: 'Требуются поля player1Id, player2Id и ticketsAmount' },
        { status: 400 }
      );
    }

    // Подключаемся к базе данных
    try {
      await connectToDatabase();
      console.log('[API match/create] Успешное подключение к базе данных');
    } catch (dbError) {
      console.error('[API match/create] Ошибка подключения к БД:', dbError);
      return NextResponse.json(
        { success: false, error: 'Ошибка подключения к базе данных', details: dbError instanceof Error ? dbError.message : 'Неизвестная ошибка' },
        { status: 500 }
      );
    }

    // Преобразуем ID игроков в числа для поиска в базе
    const player1Id = Number(matchData.player1Id);
    const player2Id = Number(matchData.player2Id);
    const ticketsAmount = Number(matchData.ticketsAmount);

    // Проверяем, что игроки различны
    if (player1Id === player2Id) {
      console.error('[API match/create] Попытка создать матч с одним и тем же игроком');
      return NextResponse.json(
        { success: false, error: 'Нельзя создать матч с одним и тем же игроком' },
        { status: 400 }
      );
    }

    // Ищем игроков в базе данных
    const player1 = await User.findOne({ telegramId: player1Id });
    const player2 = await User.findOne({ telegramId: player2Id });

    // Проверяем, найдены ли игроки
    if (!player1) {
      console.error(`[API match/create] Игрок 1 с telegramId ${player1Id} не найден`);
      return NextResponse.json(
        { success: false, error: 'Игрок 1 не найден' },
        { status: 404 }
      );
    }

    if (!player2) {
      console.error(`[API match/create] Игрок 2 с telegramId ${player2Id} не найден`);
      return NextResponse.json(
        { success: false, error: 'Игрок 2 не найден' },
        { status: 404 }
      );
    }

    // Проверяем, достаточно ли билетов у игроков
    if ((player1.tickets || 0) < ticketsAmount) {
      console.error(`[API match/create] У игрока 1 недостаточно билетов: ${player1.tickets || 0} < ${ticketsAmount}`);
      return NextResponse.json(
        { success: false, error: 'У игрока 1 недостаточно билетов' },
        { status: 400 }
      );
    }

    if ((player2.tickets || 0) < ticketsAmount) {
      console.error(`[API match/create] У игрока 2 недостаточно билетов: ${player2.tickets || 0} < ${ticketsAmount}`);
      return NextResponse.json(
        { success: false, error: 'У игрока 2 недостаточно билетов' },
        { status: 400 }
      );
    }

    // Создаем уникальный ID для матча
    const matchId = uuidv4();

    // Создаем новый матч
    const match = new Match({
      matchId,
      player1Id,
      player1Name: player1.firstName || 'Player 1',
      player2Id,
      player2Name: player2.firstName || 'Player 2',
      ticketsAmount,
      status: 'pending',
      createdAt: new Date()
    });

    // Сохраняем матч
    await match.save();
    console.log(`[API match/create] Матч успешно создан с ID: ${matchId}`);

    // Возвращаем данные матча
    return NextResponse.json({
      success: true,
      data: {
        matchId: match.matchId,
        player1Id: match.player1Id,
        player1Name: match.player1Name,
        player2Id: match.player2Id,
        player2Name: match.player2Name,
        ticketsAmount: match.ticketsAmount,
        status: match.status,
        createdAt: match.createdAt
      }
    });
  } catch (error) {
    console.error('[API match/create] Ошибка при создании матча:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка при создании матча', details: error instanceof Error ? error.message : 'Неизвестная ошибка' },
      { status: 500 }
    );
  }
} 