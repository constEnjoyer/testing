import TelegramBot from 'node-telegram-bot-api';
import { formatTonAmount, formatDate } from '../utils/formatUtils';

// Получаем токены ботов из переменных окружения
const appBotToken = process.env.TELEGRAM_BOT_TOKEN;
// Используем отдельный токен для бота уведомлений
const notificationBotToken = process.env.TELEGRAM_NOTIFICATION_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
// ID чата администратора
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
// URL вебхука для обработки колбэков от кнопок
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || 
                  `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram-webhook`;

// Проверяем наличие необходимых переменных
const isBotConfigured = !!notificationBotToken && !!adminChatId;
console.log('[TelegramNotifier] Настройка бота. Токен уведомлений есть:', !!notificationBotToken, 'Admin Chat ID есть:', !!adminChatId);

// Создаем экземпляр бота только если есть токен и ID чата
let bot: TelegramBot | null = null;

// Инициализация бота только на сервере
if (typeof window === 'undefined' && isBotConfigured) {
  try {
    console.log('[TelegramNotifier] Инициализация Telegram бота с токеном уведомлений:', notificationBotToken?.substring(0, 10) + '...');
    
    // В режиме разработки используем polling
    if (process.env.NODE_ENV !== 'production') {
      bot = new TelegramBot(notificationBotToken as string, { polling: true });
      console.log('[TelegramNotifier] Telegram бот для уведомлений инициализирован в режиме polling');
    } else {
      // В продакшене используем webhook
      bot = new TelegramBot(notificationBotToken as string, { polling: false });
      
      // Настройку вебхука делаем только в специальном API-маршруте, а не при инициализации
      console.log('[TelegramNotifier] Telegram бот для уведомлений успешно инициализирован в режиме webhook');
    }
  } catch (error) {
    console.error('[TelegramNotifier] Ошибка при инициализации Telegram бота для уведомлений:', error);
  }
}

/**
 * Отправляет уведомление администратору через Telegram
 */
export async function sendMessageToAdmin(
  message: string, 
  buttons: Array<Array<{ text: string, callback_data: string }>> = []
): Promise<boolean> {
  if (!bot || !adminChatId) {
    console.error('[TelegramNotifier] Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID');
    return false;
  }

  try {
    const options: TelegramBot.SendMessageOptions = {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    // Добавляем инлайн-кнопки, если они предоставлены
    if (buttons && buttons.length > 0) {
      options.reply_markup = {
        inline_keyboard: buttons
      };
    }

    // Отправляем сообщение администратору
    await bot.sendMessage(adminChatId as string, message, options);
    console.log('[TelegramNotifier] Сообщение успешно отправлено администратору');
    return true;
  } catch (error) {
    console.error('[TelegramNotifier] Ошибка при отправке сообщения администратору:', error);
    return false;
  }
}

/**
 * Отправляет уведомление администратору о новом запросе на вывод средств с кнопками для управления
 */
export async function sendWithdrawalRequestNotification(amount: number, address: string, orderNumber: string): Promise<boolean> {
  if (!bot || !adminChatId) {
    console.error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID');
    return false;
  }

  try {
    // Получаем данные из запроса с проверкой на undefined
    const formattedAmount = formatTonAmount(amount);
    const walletAddress = address || '';
    
    // Форматируем сообщение для администратора
    const message = `
🔔 *Новый запрос на вывод средств*

💰 *Сумма*: ${formattedAmount} TON
💼 *Кошелек*: \`${walletAddress}\`
⏱️ *Время запроса*: ${formatDate(new Date().toISOString())}
    `;

    // Создаем инлайн-кнопки для одобрения и отклонения запроса
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '✅ ОДОБРИТЬ',
            callback_data: `approve_${orderNumber}`
          },
          {
            text: '❌ ОТКЛОНИТЬ',
            callback_data: `reject_${orderNumber}`
          }
        ]
      ]
    };

    // Отправляем сообщение администратору с кнопками
    await bot.sendMessage(adminChatId as string, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard
    });

    console.log('Уведомление о выводе с кнопками успешно отправлено администратору');
    return true;
  } catch (error) {
    console.error('Ошибка при отправке уведомления через Telegram:', error);
    return false;
  }
}

/**
 * Отправляет уведомление пользователю о статусе запроса на вывод
 */
export async function sendWithdrawalStatusNotification(
  chatId: string,
  status: string,
  amount: number,
  orderNumber: string
): Promise<boolean> {
  try {
    console.log(`[TelegramNotifier] Начинаем отправку уведомления. chatId: "${chatId}", тип: ${typeof chatId}`);
    
    if (!bot) {
      console.error('[TelegramNotifier] Бот не настроен при отправке уведомления о статусе вывода');
      return false;
    }

    // Форматируем сумму, чтобы избежать научной нотации
    const formattedAmount = formatTonAmount(amount);
    console.log(`[TelegramNotifier] Отформатированная сумма: ${formattedAmount} TON`);

    let messageText = '';
    if (status === 'completed') {
      messageText = `✅ Ваш вывод ${formattedAmount} TON успешно выполнен!\n\nНомер заявки: #${orderNumber}`;
    } else if (status === 'rejected') {
      messageText = `❌ Ваш вывод ${formattedAmount} TON отклонен.\n\nСумма возвращена на ваш баланс.\nНомер заявки: #${orderNumber}`;
    } else {
      messageText = `ℹ️ Статус вашего вывода ${formattedAmount} TON изменен на: ${status}\n\nНомер заявки: #${orderNumber}`;
    }

    // Отправляем сообщение пользователю
    console.log(`[TelegramNotifier] Подготовлено сообщение: ${messageText}`);
    
    // Преобразуем chatId в строку, если это число
    const chatIdStr = String(chatId);
    console.log(`[TelegramNotifier] chatId после преобразования: "${chatIdStr}"`);
    
    await bot.sendMessage(chatIdStr, messageText, {
      parse_mode: 'Markdown'
    });

    console.log(`[TelegramNotifier] Уведомление о статусе вывода (${status}) успешно отправлено пользователю ${chatIdStr}`);
    return true;
  } catch (error) {
    console.error('[TelegramNotifier] Ошибка при отправке уведомления через Telegram:', error);
    return false;
  }
}

/**
 * Обработчик колбэков от кнопок Telegram
 */
export async function handleTelegramCallback(callbackQuery: TelegramBot.CallbackQuery): Promise<boolean> {
  if (!bot) {
    console.error('[TelegramNotifier] Telegram бот не настроен');
    return false;
  }

  try {
    const { data, message, id } = callbackQuery;
    
    if (!data || !message) {
      console.error('[TelegramNotifier] Некорректные данные колбэка');
      return false;
    }
    
    console.log('[TelegramNotifier] Получен колбэк от Telegram:', data);
    
    // Парсим данные колбэка: approve_ID или reject_ID
    const [action, requestId] = data.split('_');
    
    if (!action || !requestId || (action !== 'approve' && action !== 'reject')) {
      console.error('[TelegramNotifier] Некорректный формат данных колбэка:', data);
      return false;
    }
    
    // КРИТИЧЕСКИ ВАЖНО: отвечаем на колбэк для Telegram
    await bot.answerCallbackQuery(id, {
      text: action === 'approve' ? 'Запрос одобрен' : 'Запрос отклонен',
    });
    
    // Отправляем уведомление администратору о статусе обработки
    const statusEmoji = action === 'approve' ? '✅' : '❌';
    const statusText = action === 'approve' ? 'ОДОБРЕН' : 'ОТКЛОНЕН';
    
    await bot.editMessageText(
      `${message.text}\n\n${statusEmoji} Запрос ${statusText}`,
      {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML'
      }
    );
    
    // НОВОЕ: Вызываем API для обработки одобрения/отклонения вывода
    console.log('[TelegramNotifier] Вызываем API для обработки вывода:', {
      requestId,
      status: action
    });
    
    try {
      // Создаем полный URL для запроса к API
      const baseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tonot-chance.vercel.app';
      const url = new URL('/api/withdraw-approve', baseUrl);
      
      console.log(`[TelegramNotifier] Отправка запроса на URL: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          status: action
        }),
      });
      
      const result = await response.json();
      console.log('[TelegramNotifier] Результат API вызова:', result);
      
      if (!result.success) {
        console.error('[TelegramNotifier] Ошибка при обработке вывода:', result.error);
      }
    } catch (apiError) {
      console.error('[TelegramNotifier] Ошибка при вызове API:', apiError);
    }
    
    return true;
  } catch (error) {
    console.error('[TelegramNotifier] Ошибка при обработке колбэка Telegram:', error);
    return false;
  }
}

/**
 * Обновляет сообщение администратора о статусе обработки запроса
 */
export async function updateAdminRequestMessage(
  chatId: string | number,
  messageId: number,
  originalText: string,
  status: 'completed' | 'rejected',
  error?: string
): Promise<boolean> {
  if (!bot) {
    console.error('[TelegramNotifier] Telegram бот не настроен');
    return false;
  }

  try {
    let statusEmoji = status === 'completed' ? '✅' : '❌';
    let statusText = status === 'completed' ? 'ОДОБРЕН' : 'ОТКЛОНЕН';
    
    let newText = `${originalText}\n\n${statusEmoji} Запрос ${statusText}`;
    
    if (error) {
      newText += `\n\n⚠️ Ошибка: ${error}`;
    }
    
    await bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML'
    });
    
    console.log(`[TelegramNotifier] Сообщение обновлено: статус=${status}, chatId=${chatId}`);
    return true;
  } catch (error: any) {
    // Игнорируем ошибку, если сообщение не было изменено (содержимое идентично)
    if (error.message && error.message.includes('message is not modified')) {
      console.log('[TelegramNotifier] Сообщение не изменено, так как содержимое идентично');
      return true;
    }
    
    console.error('[TelegramNotifier] Ошибка при обновлении сообщения администратора:', error);
    return false;
  }
}

// Создаем объект для экспорта
interface TelegramNotifier {
  sendMessageToAdmin: (message: string, buttons?: Array<Array<{ text: string, callback_data: string }>>) => Promise<boolean>;
  sendWithdrawalRequestNotification: (amount: number, address: string, orderNumber: string) => Promise<boolean>;
  sendWithdrawalStatusNotification: (chatId: string, status: string, amount: number, orderNumber: string) => Promise<boolean>;
  handleTelegramCallback: (callbackQuery: TelegramBot.CallbackQuery) => Promise<boolean>;
  updateAdminRequestMessage: (chatId: string | number, messageId: number, originalText: string, status: 'completed' | 'rejected', error?: string) => Promise<boolean>;
  isConfigured: boolean;
  bot: TelegramBot | null;
}

// Экспортируем объект
const telegramNotifier: TelegramNotifier = {
  sendMessageToAdmin,
  sendWithdrawalRequestNotification,
  sendWithdrawalStatusNotification,
  handleTelegramCallback,
  updateAdminRequestMessage,
  isConfigured: isBotConfigured,
  bot
};

// Экспортируем объект
export default telegramNotifier; 