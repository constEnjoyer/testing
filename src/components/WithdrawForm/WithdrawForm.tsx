import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface WithdrawFormProps {
  balance: number;
  updateBalance: () => void;
}

export const WithdrawForm: React.FC<WithdrawFormProps> = ({ balance, updateBalance }) => {
  const t = useTranslations('exchange_modal');
  const actions = useTranslations('actions');
  const messages = useTranslations('messages');
  const [amount, setAmount] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [notificationInfo, setNotificationInfo] = useState<React.ReactNode | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          walletAddress,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Запрос на вывод создан успешно! Ордер № ${data.data.orderNumber}`);
        setAmount('');
        setWalletAddress('');
        updateBalance();
        
        // Проверяем наличие уведомления о необходимости подписаться на бота
        if (data.data.note && data.data.note.includes('@TonotWithdrawalBot')) {
          setTimeout(() => {
            setNotificationInfo(
              <div className="mt-2 p-2 bg-gray-100 rounded-md text-sm">
                <p className="mb-1">👉 Чтобы получать уведомления о статусе вывода, напишите боту:</p>
                <a 
                  href="https://t.me/TonotWithdrawalBot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 underline font-medium"
                >
                  @TonotWithdrawalBot
                </a>
                <p className="mt-1">Отправьте ему команду /start</p>
              </div>
            );
          }, 1000);
        }
      } else {
        setError(data.error || 'Произошла ошибка при отправке запроса');
      }
    } catch (err) {
      setError('Произошла ошибка при отправке запроса');
      console.error(err);
    }
    
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">{t('title')}</h2>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-2 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {notificationInfo && (
        <div className="mb-4">
          {notificationInfo}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
            {t('withdraw_amount')}
          </label>
          <div className="flex items-center">
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={balance}
              className="shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline flex-grow"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={loading}
            />
            <span className="ml-2 text-gray-600">TON</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('ton_balance', { amount: balance })}
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="walletAddress">
            {t('wallet_address')}
          </label>
          <input
            id="walletAddress"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="UQD..."
            required
            disabled={loading}
          />
        </div>
        
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 text-blue-700 rounded">
          <p className="text-sm">⚠️ <b>Важно:</b> Для получения уведомлений о статусе вывода средств, напишите боту <a href="https://t.me/tonotchancebot" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">@tonotchancebot</a> команду <b>/start</b> </p>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={loading || !amount || !walletAddress || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
          >
            {loading ? t('processing') : t('withdraw_button')}
          </button>
        </div>
      </form>
    </div>
  );
}; 