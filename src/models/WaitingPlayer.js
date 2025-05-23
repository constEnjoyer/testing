import mongoose from 'mongoose';

// Схема для ожидающих игроков
const waitingPlayerSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId },
  telegramId: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) }, // 10 минут
});

// Создаем модель только если она еще не существует
const WaitingPlayer = mongoose.models.WaitingPlayer || mongoose.model('WaitingPlayer', waitingPlayerSchema, 'waitingPlayers');

export default WaitingPlayer; 