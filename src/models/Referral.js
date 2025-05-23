import mongoose from 'mongoose';

/**
 * Схема реферала - запись о реферальной связи
 */
const referralSchema = new mongoose.Schema({
  // Реферер - пользователь, который пригласил
  refererId: { 
    type: Number, 
    required: true
  },
  // Реферал - приглашенный пользователь
  referralId: { 
    type: Number, 
    required: true
  },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  photoUrl: { type: String },
  // Статусы игр (после регистрации)
  hasPlayedRoomA: { type: Boolean, default: false },
  hasPlayedRoomB: { type: Boolean, default: false },
  isValid: { type: Boolean, default: false },
  // Даты игр
  roomAPlayedAt: { type: Date },
  roomBPlayedAt: { type: Date },
  // Даты
  createdAt: { type: Date, default: Date.now },
  validatedAt: { type: Date }, // Дата когда стал валидным
  // Бонусы
  bonusGiven: { type: Boolean, default: false },
  bonusAmount: { type: Number, default: 0 }
}, { 
  timestamps: true, 
  collection: 'referrals' 
});

// Перед сохранением проверяем валидность реферала
referralSchema.pre('save', function(next) {
  // Проверяем, что игры были сыграны после создания реферальной связи
  const now = new Date();
  
  // Проверяем игру в комнате A
  if (this.roomAPlayedAt && this.roomAPlayedAt > this.createdAt) {
    this.hasPlayedRoomA = true;
  }
  
  // Проверяем игру в комнате B
  if (this.roomBPlayedAt && this.roomBPlayedAt > this.createdAt) {
    this.hasPlayedRoomB = true;
  }
  
  // Если обе игры сыграны после регистрации и реферал еще не валиден
  if (this.hasPlayedRoomA && this.hasPlayedRoomB && !this.isValid) {
    this.isValid = true;
    this.validatedAt = now;
    console.log(`[ReferralModel] Реферал ${this.referralId} стал валидным для реферера ${this.refererId}`, {
      roomAPlayedAt: this.roomAPlayedAt,
      roomBPlayedAt: this.roomBPlayedAt,
      createdAt: this.createdAt,
      validatedAt: this.validatedAt
    });
  }
  next();
});

// Удаляем старый индекс при инициализации модели
const dropOldIndex = async () => {
  try {
    await mongoose.connection.collection('referrals').dropIndex('referalId_1');
    console.log('[ReferralModel] ✅ Старый индекс referalId_1 успешно удален');
  } catch (error) {
    // Игнорируем ошибку если индекс не существует
    console.log('[ReferralModel] ℹ️ Старый индекс не найден или уже удален');
  }
};

// Определяем правильные индексы
referralSchema.index({ referralId: 1 }, { unique: true });
referralSchema.index({ refererId: 1, referralId: 1 }, { unique: true });
referralSchema.index({ refererId: 1, createdAt: -1 });
referralSchema.index({ referralId: 1, isValid: 1 });

// Методы для проверки и обновления игр
referralSchema.methods = {
  /**
   * Обновляет статус игры
   * @param {string} gameType - Тип игры ('A' или 'B')
   * @param {Date} gameDate - Дата игры
   */
  async updateGameStatus(gameType, gameDate) {
    if (!gameDate || gameDate <= this.createdAt) {
      return false;
    }

    if (gameType === 'A' && !this.hasPlayedRoomA) {
      this.roomAPlayedAt = gameDate;
      this.markModified('roomAPlayedAt');
      await this.save();
      return true;
    }

    if (gameType === 'B' && !this.hasPlayedRoomB) {
      this.roomBPlayedAt = gameDate;
      this.markModified('roomBPlayedAt');
      await this.save();
      return true;
    }

    return false;
  }
};

// Создаем модель
const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema, 'referrals');

// Удаляем старый индекс при первой инициализации модели
if (!mongoose.models.Referral) {
  dropOldIndex().catch(console.error);
}

console.log('[ReferralModel] Модель Referral инициализирована');
console.log('[ReferralModel] Имя коллекции:', Referral.collection?.name || 'Неизвестно');

export default Referral; 