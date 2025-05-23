/**
 * Модуль утилит для форматирования данных
 * Содержит функции для форматирования различных типов данных
 */

/**
 * Форматирует число TON без научной нотации
 * @param amount Число для форматирования
 * @returns Строковое представление числа без научной нотации
 */
export function formatTonAmount(amount: number): string {
  return amount.toFixed(12).replace(/\.?0+$/, '');
}

/**
 * Преобразует строку в число с поддержкой малых значений TON
 * @param amountStr Строка или число для преобразования
 * @returns Число
 */
export function parseTonAmount(amountStr: string | number): number {
  const amount = typeof amountStr === 'string' ? Number(amountStr) : amountStr;
  return Number(amount.toFixed(12));
}

/**
 * Форматирует число с разделителями тысяч
 * @param value - число для форматирования
 * @param options - настройки форматирования
 * @returns отформатированное число в виде строки
 */
export function formatNumber(
  value: number, 
  options: { 
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    style?: 'decimal' | 'currency' | 'percent';
    currency?: string;
  } = {}
): string {
  const { 
    locale = 'ru-RU', 
    minimumFractionDigits = 0, 
    maximumFractionDigits = 0,
    style = 'decimal',
    currency = 'TON' 
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style,
      currency,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value);
  } catch (error) {
    console.error('Ошибка при форматировании числа:', error);
    return value.toString();
  }
}

/**
 * Форматирует валюту
 * @param value - сумма для форматирования
 * @param options - настройки форматирования
 * @returns отформатированная сумма с символом валюты
 */
export function formatCurrency(
  value: number,
  options: {
    locale?: string;
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  return formatNumber(value, {
    ...options,
    style: 'currency',
    currency: options.currency || 'TON'
  });
}

/**
 * Форматирует дату в локализованном формате
 * @param date - дата для форматирования (Date, строка или число)
 * @param options - настройки форматирования
 * @returns отформатированная дата в виде строки
 */
export function formatDate(
  date: Date | string | number,
  options: {
    locale?: string;
    dateStyle?: 'full' | 'long' | 'medium' | 'short';
    timeStyle?: 'full' | 'long' | 'medium' | 'short';
    formatType?: 'date' | 'time' | 'dateTime';
  } = {}
): string {
  const {
    locale = 'ru-RU',
    dateStyle = 'medium',
    timeStyle = 'short',
    formatType = 'dateTime'
  } = options;

  try {
    const dateObject = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObject.getTime())) {
      throw new Error('Некорректная дата');
    }

    const formatter = new Intl.DateTimeFormat(locale, {
      ...(formatType === 'date' || formatType === 'dateTime' ? { dateStyle } : {}),
      ...(formatType === 'time' || formatType === 'dateTime' ? { timeStyle } : {})
    });

    return formatter.format(dateObject);
  } catch (error) {
    console.error('Ошибка при форматировании даты:', error);
    return String(date);
  }
}

/**
 * Сокращает текст до указанной длины с добавлением многоточия в конце
 * @param text - исходный текст
 * @param maxLength - максимальная длина текста
 * @param suffix - суффикс, добавляемый к сокращенному тексту
 * @returns сокращенный текст
 */
export function truncateText(
  text: string, 
  maxLength: number = 100, 
  suffix: string = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Форматирует имя пользователя, если оно слишком длинное
 * @param name - имя пользователя
 * @param maxLength - максимальная длина имени
 * @returns отформатированное имя
 */
export function formatUsername(name: string, maxLength: number = 20): string {
  return truncateText(name, maxLength);
} 