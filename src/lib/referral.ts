import { connectToDatabase } from './db';
import User from '@/models/User';
import Referral from '@/models/Referral';

/**
 * Интерфейс для хранения информации о реферале
 */
interface ReferralInfo {
  userId: number;
  username?: string;
  photoUrl?: string;
  roomAPlayed: boolean;
  roomBPlayed: boolean;
  isValid: boolean;
}

/**
 * Класс для работы с реферальной системой
 */
export class ReferralService {
  /**
   * Проверяет существование реферальной связи
   */
  static async checkExistingReferral(refererId: number, referalId: number): Promise<boolean> {
    await connectToDatabase();
    const existingReferral = await Referral.findOne({
      refererId,
      referalId
    });
    return !!existingReferral;
  }

  /**
   * Проверяет наличие незавершенных реферальных связей
   */
  static async checkPendingReferral(referalId: number): Promise<boolean> {
    await connectToDatabase();
    const pendingReferral = await Referral.findOne({
      referalId,
      isValid: false
    });
    return !!pendingReferral;
  }

  /**
   * Создает новую реферальную связь
   */
  static async createReferral(refererId: number, referalId: number, userData: any): Promise<any> {
    await connectToDatabase();

    // Создаем запись в коллекции Referral
    const newReferral = new Referral({
      refererId,
      referalId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      photoUrl: userData.photoUrl,
      hasPlayedRoomA: false,
      hasPlayedRoomB: false,
      isValid: false,
      createdAt: new Date()
    });

    await newReferral.save();

    // Обновляем информацию у реферера
    const referer = await User.findOne({ telegramId: refererId });
    if (referer) {
      if (!referer.referrals) {
        referer.referrals = [];
      }

      referer.referrals.push({
        userId: referalId,
        username: userData.username,
        photoUrl: userData.photoUrl,
        roomAPlayed: false,
        roomBPlayed: false,
        isValid: false
      });

      await referer.save();
    }

    return newReferral;
  }

  /**
   * Обновляет статус игры для реферала
   */
  static async updateGameStatus(referralId: number, gameType: 'A' | 'B'): Promise<boolean> {
    try {
      await connectToDatabase();
      
      console.log(`[ReferralService] Поиск реферала для обновления статуса игры. ID: ${referralId}, тип: ${gameType}`);
      
      // Ищем реферала по referralId
      const referral = await Referral.findOne({ referralId });
      
      if (!referral) {
        console.log(`[ReferralService] Реферал не найден: ${referralId}`);
        return false;
      }
      
      console.log(`[ReferralService] Найден реферал:`, {
        referralId: referral.referralId,
        hasPlayedRoomA: referral.hasPlayedRoomA,
        hasPlayedRoomB: referral.hasPlayedRoomB,
        isValid: referral.isValid
      });

      const now = new Date();
      
      // Обновляем статус игры
      if (gameType === 'A' && !referral.hasPlayedRoomA) {
        referral.hasPlayedRoomA = true;
        referral.roomAPlayedAt = now;
        console.log(`[ReferralService] Обновлен статус игры A для реферала ${referralId}`);
      } else if (gameType === 'B' && !referral.hasPlayedRoomB) {
        referral.hasPlayedRoomB = true;
        referral.roomBPlayedAt = now;
        console.log(`[ReferralService] Обновлен статус игры B для реферала ${referralId}`);
      }

      // Проверяем валидность
      if (referral.hasPlayedRoomA && referral.hasPlayedRoomB && !referral.isValid) {
        referral.isValid = true;
        referral.validatedAt = now;
        console.log(`[ReferralService] Реферал ${referralId} выполнил все условия`);

        // Обновляем статистику реферера
        const referer = await User.findOne({ telegramId: referral.refererId });
        if (referer) {
          referer.totalValidReferrals = (referer.totalValidReferrals || 0) + 1;
          referer.pendingBonuses = (referer.pendingBonuses || 0) + 1;
          await referer.save();
          console.log(`[ReferralService] Обновлена статистика реферера ${referral.refererId}`);
        }
      }

      await referral.save();
      console.log(`[ReferralService] Сохранены изменения для реферала ${referralId}`);
      return true;
    } catch (error) {
      console.error('[ReferralService] Ошибка при обновлении статуса игры:', error);
      return false;
    }
  }

  /**
   * Получает информацию о рефералах пользователя
   */
  static async getReferralInfo(telegramId: number) {
    await connectToDatabase();
    
    const user = await User.findOne({ telegramId });
    if (!user) return null;

    const referrals = await Referral.find({ refererId: telegramId });
    
    return {
      referralCode: user.referralCode,
      referrals: user.referrals || [],
      totalValidReferrals: user.totalValidReferrals || 0,
      bonusesReceived: user.bonusesReceived || 0,
      pendingBonuses: user.pendingBonuses || 0,
      channelSubscribed: user.channelSubscribed || false
    };
  }

  /**
   * Проверяет и обновляет статус подписки на канал
   */
  static async updateChannelSubscription(telegramId: number, isSubscribed: boolean) {
    await connectToDatabase();
    
    const user = await User.findOne({ telegramId });
    if (!user) return false;

    user.channelSubscribed = isSubscribed;
    await user.save();
    return true;
  }
} 