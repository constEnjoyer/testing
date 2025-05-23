import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true },
  player1Id: { type: Number, required: true },
  player1Name: { type: String, required: true },
  player2Id: { type: Number, required: true },
  player2Name: { type: String, required: true },
  winnerId: { type: Number },
  ticketsAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['waiting', 'matched', 'completed', 'canceled'], 
    default: 'waiting' 
  },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  canceledAt: { type: Date },
  cancelReason: { type: String }
});

// Обновление даты завершения при изменении статуса на 'completed'
matchSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status === 'canceled' && !this.canceledAt) {
      this.canceledAt = new Date();
    }
  }
  next();
});

// Создаем модель только если она еще не существует
const Match = mongoose.models.Match || mongoose.model('Match', matchSchema);

export default Match; 