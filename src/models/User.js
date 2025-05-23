import mongoose from 'mongoose';

console.log('[UserModel] Инициализация модели пользователя');

const purchaseHistorySchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    tickets: { type: Number, required: true },
    transactionId: { type: String, required: true }
});

const gameHistorySchema = new mongoose.Schema({
    matchId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    opponentId: { type: String, required: true },
    opponentName: { type: String, required: true },
    result: { type: String, enum: ['win', 'lose'], required: true },
    tonotChanceTickets: { type: Number, required: true }
});

// Схема для хранения информации о рефералах
const referralSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    username: { type: String },
    photoUrl: { type: String },
    hasPlayedRoomA: { type: Boolean, default: false },
    hasPlayedRoomB: { type: Boolean, default: false },
    isValid: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    validatedAt: { type: Date }
});

const userSchema = new mongoose.Schema({
    telegramId: {
        type: Number,
        required: true
    },
    firstName: { type: String },
    lastName: { type: String },
    username: { type: String },
    photoUrl: { type: String },
    chatId: { type: String },
    tickets: { type: Number, default: 0 },
    tonotChanceTickets: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    tonBalance: { type: Number, default: 0 },
    walletAddress: { type: String },
    locale: { type: String, enum: ['en', 'ru'], default: 'en' },
    // Реферальная система
    referralCode: {
        type: String
    },
    referredBy: [{
        userId: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }],
    referrals: [referralSchema],
    bonusesReceived: { type: Number, default: 0 },
    totalValidReferrals: { type: Number, default: 0 },
    pendingBonuses: { type: Number, default: 0 },
    channelSubscribed: { type: Boolean, default: false },
    // История
    purchaseHistory: [purchaseHistorySchema],
    gameHistory: [gameHistorySchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'users' });

// Все индексы определяем явно
userSchema.index({ telegramId: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true });
userSchema.index({ referredBy: 1 });

// Обновление даты при изменении документа
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    console.log('[UserModel] pre-save hook вызван для пользователя с telegramId:', this.telegramId);
    next();
});

// Методы для работы с рефералами
userSchema.methods = {
    /**
     * Добавляет нового реферера
     */
    async addReferer(refererId) {
        // Проверяем, существует ли уже такой реферер
        const existingReferer = this.referredBy ? .find(ref => ref.userId === refererId);
        if (existingReferer) {
            return false;
        }

        // Добавляем нового реферера
        if (!this.referredBy) {
            this.referredBy = [];
        }

        this.referredBy.push({
            userId: refererId,
            date: new Date()
        });

        await this.save();
        return true;
    },

    /**
     * Проверяет, является ли пользователь рефералом для указанного реферера
     */
    isReferralOf(refererId) {
        return this.referredBy ? .some(ref => ref.userId === refererId) || false;
    }
};

// Создаем модель только если она еще не существует
console.log('[UserModel] Проверка существования модели User...');
const modelExists = mongoose.models.User !== undefined;
console.log('[UserModel] Модель User существует:', modelExists);

// Явно указываем коллекцию "users" и базу данных через опции
const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');

console.log('[UserModel] Модель User инициализирована');
console.log('[UserModel] Имя коллекции:', User.collection ? .name || 'Неизвестно');

export default User;