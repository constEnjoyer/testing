/**
 * Модуль утилит для валидации пользовательских данных и форм
 * Содержит функции для проверки правильности ввода, валидации форм и форматов данных
 */

/**
 * Проверяет, является ли строка действительным адресом кошелька TON
 * @param address - строка для проверки (адрес TON)
 * @returns true, если строка является валидным адресом TON
 */
export function isValidTonAddress(address: string): boolean {
  // Базовая проверка формата TON адреса (EQ...)
  if (!address) return false;
  
  // Проверка на стандартный формат TON адреса
  const tonAddressRegex = /^(?:EQ)?[a-zA-Z0-9_-]{48}$/;
  return tonAddressRegex.test(address);
}

/**
 * Проверяет, является ли значение допустимым числом токенов для операции
 * @param value - значение для проверки
 * @param minAmount - минимально допустимое количество (по умолчанию 0)
 * @param maxAmount - максимально допустимое количество (по умолчанию Infinity)
 * @returns true, если значение является допустимым числом токенов
 */
export function isValidTokenAmount(
  value: number | string, 
  minAmount: number = 0, 
  maxAmount: number = Infinity
): boolean {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  
  // Проверка на NaN и другие некорректные значения
  if (isNaN(amount) || !isFinite(amount)) {
    return false;
  }
  
  // Проверка диапазона значений
  return amount >= minAmount && amount <= maxAmount;
}

/**
 * Проверяет, являются ли строка паролем с нужным уровнем сложности
 * @param password - строка для проверки
 * @param options - настройки проверки (минимальная длина, требования к символам)
 * @returns объект с результатом проверки и сообщениями
 */
export function validatePassword(
  password: string,
  options = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
): { isValid: boolean; messages: string[] } {
  const messages: string[] = [];
  
  // Проверка длины
  if (password.length < options.minLength) {
    messages.push(`Пароль должен содержать не менее ${options.minLength} символов`);
  }
  
  // Проверка наличия прописных букв
  if (options.requireUppercase && !/[A-ZА-Я]/.test(password)) {
    messages.push('Пароль должен содержать хотя бы одну прописную букву');
  }
  
  // Проверка наличия строчных букв
  if (options.requireLowercase && !/[a-zа-я]/.test(password)) {
    messages.push('Пароль должен содержать хотя бы одну строчную букву');
  }
  
  // Проверка наличия цифр
  if (options.requireNumbers && !/\d/.test(password)) {
    messages.push('Пароль должен содержать хотя бы одну цифру');
  }
  
  // Проверка наличия специальных символов
  if (options.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    messages.push('Пароль должен содержать хотя бы один специальный символ');
  }
  
  return {
    isValid: messages.length === 0,
    messages
  };
}

/**
 * Валидирует форму создания игры
 * @param gameOptions - опции создания игры
 * @returns объект с результатом валидации и сообщениями об ошибках
 */
export function validateGameOptions(gameOptions: {
  ticketPrice?: number;
  maxPlayers?: number;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  // Проверка цены билета
  if (!gameOptions.ticketPrice) {
    errors.ticketPrice = 'Требуется указать цену билета';
  } else if (gameOptions.ticketPrice <= 0) {
    errors.ticketPrice = 'Цена билета должна быть положительным числом';
  }
  
  // Проверка количества игроков
  if (!gameOptions.maxPlayers) {
    errors.maxPlayers = 'Требуется указать максимальное количество игроков';
  } else if (gameOptions.maxPlayers < 2) {
    errors.maxPlayers = 'В игре должно быть как минимум 2 игрока';
  } else if (gameOptions.maxPlayers > 100) {
    errors.maxPlayers = 'Максимальное количество игроков не может превышать 100';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Проверяет имя пользователя на соответствие требованиям
 * @param username - строка для проверки
 * @returns объект с результатом валидации и сообщением об ошибке
 */
export function validateUsername(username: string): { isValid: boolean; message?: string } {
  if (!username || username.trim().length === 0) {
    return { isValid: false, message: 'Имя пользователя не может быть пустым' };
  }
  
  if (username.length < 3) {
    return { isValid: false, message: 'Имя пользователя должно содержать не менее 3 символов' };
  }
  
  if (username.length > 50) {
    return { isValid: false, message: 'Имя пользователя не может превышать 50 символов' };
  }
  
  // Проверка на специальные символы и допустимые знаки
  const validUsernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!validUsernameRegex.test(username)) {
    return { isValid: false, message: 'Имя пользователя может содержать только латинские буквы, цифры и символы _.-' };
  }
  
  return { isValid: true };
} 