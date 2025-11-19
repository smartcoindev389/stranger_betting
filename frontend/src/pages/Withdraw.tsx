import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpCircle, Wallet, History } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import Header from '../components/Header';

interface WithdrawProps {
  userId?: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

interface PixTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: string;
  pixKey?: string | null;
  balanceAfter?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Withdraw({ userId, onNavigate, isConnected }: WithdrawProps) {
  const { showNotification } = useNotification();
  const [balance, setBalance] = useState<number>(0);
  const [pixKey, setPixKey] = useState<string>('');
  const [hasPixKey, setHasPixKey] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawPixKey, setWithdrawPixKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<PixTransaction[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const currentUserId = userId || localStorage.getItem('userId') || '';

  useEffect(() => {
    if (currentUserId) {
      fetchBalance();
      fetchPixKey();
      fetchTransactions();
    }
  }, [currentUserId]);

  const fetchBalance = async () => {
    if (!currentUserId) return;
    try {
      const socket = (window as any).socket;
      if (socket) {
        socket.emit('get_betting_info');
        socket.once('betting_info', (data: { userBalance: number }) => {
          setBalance(data.userBalance || 0);
        });
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchPixKey = async () => {
    if (!currentUserId) return;
    try {
      const { authenticatedFetch } = await import('../utils/api');
      const response = await authenticatedFetch(`${API_BASE}/api/pix/pix-key/${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        setHasPixKey(data.hasPixKey);
        if (data.pixKey) {
          setPixKey(data.pixKey);
        }
      }
    } catch (error) {
      console.error('Error fetching Pix key:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!currentUserId) return;
    try {
      const { authenticatedFetch } = await import('../utils/api');
      const response = await authenticatedFetch(`${API_BASE}/api/pix/transactions`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!currentUserId) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 1) {
      showNotification('Minimum withdrawal is R$ 1.00', 'error');
      return;
    }

    if (!withdrawPixKey || withdrawPixKey.length < 3) {
      showNotification('Please enter a valid Pix key', 'error');
      return;
    }

    if (amount > balance) {
      showNotification('Insufficient balance', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const { authenticatedFetch } = await import('../utils/api');
      const response = await authenticatedFetch(`${API_BASE}/api/pix/withdrawal/request`, {
        method: 'POST',
        body: JSON.stringify({ amount, pixKey: withdrawPixKey }),
      });

      const data = await response.json();

      if (response.status === 503) {
        showNotification('Pix integration is not available yet', 'info');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        showNotification(data.error_message || data.error || 'Failed to create withdrawal request', 'error');
        setIsLoading(false);
        return;
      }

      showNotification('Withdrawal request submitted', 'success');
      setWithdrawAmount('');
      setWithdrawPixKey('');
      fetchBalance();
      fetchTransactions();
      
      // Poll for status
      pollWithdrawalStatus(data.transactionId);
    } catch (error) {
      showNotification('Error creating withdrawal request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const pollWithdrawalStatus = async (txId: string) => {
    if (!currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const { authenticatedFetch } = await import('../utils/api');
        const response = await authenticatedFetch(
          `${API_BASE}/api/pix/withdrawal/status/${txId}?userId=${currentUserId}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed') {
            clearInterval(interval);
            showNotification('Withdrawal completed successfully!', 'success');
            fetchBalance();
            fetchTransactions();
          } else if (data.status === 'failed') {
            clearInterval(interval);
            showNotification(data.errorMessage || 'Withdrawal failed', 'error');
          }
        }
      } catch (error) {
        console.error('Error polling withdrawal status:', error);
      }
    }, 3000);

    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'pending':
      case 'processing':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <Header isConnected={isConnected} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => onNavigate('home')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Withdraw Funds</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-600">Available Balance:</span>
                  <span className="text-xl font-bold text-green-600">
                    R$ {balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!showHistory ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Withdrawal Amount (BRL)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    max={balance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Available: R$ {balance.toFixed(2)} | Minimum: R$ 1.00
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pix Key
                </label>
                <input
                  type="text"
                  value={withdrawPixKey || (hasPixKey ? pixKey : '')}
                  onChange={(e) => setWithdrawPixKey(e.target.value)}
                  placeholder="CPF, email, phone, or random key"
                  className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                />
                {hasPixKey && (
                  <p className="text-xs text-gray-500 mt-2">
                    Using saved Pix key. You can change it above.
                  </p>
                )}
              </div>
              <button
                onClick={handleWithdraw}
                disabled={
                  isLoading ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) < 1 ||
                  parseFloat(withdrawAmount) > balance ||
                  !withdrawPixKey
                }
                className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                <ArrowUpCircle className="w-6 h-6" />
                {isLoading ? 'Processing...' : 'Request Withdrawal'}
              </button>

              <button
                onClick={() => setShowHistory(true)}
                className="w-full bg-gray-100 text-gray-900 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <History className="w-5 h-5" />
                View Transaction History
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
              </div>
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="border-2 border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {tx.type === 'deposit' ? (
                            <Wallet className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ArrowUpCircle className="w-5 h-5 text-red-600" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold text-lg ${
                              tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {tx.type === 'deposit' ? '+' : '-'}R$ {tx.amount.toFixed(2)}
                          </p>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getStatusColor(tx.status)}`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                      {tx.balanceAfter !== null && (
                        <p className="text-xs text-gray-500 mt-2">
                          Balance after: R$ {tx.balanceAfter.toFixed(2)}
                        </p>
                      )}
                      {tx.errorMessage && (
                        <p className="text-xs text-red-600 mt-2">{tx.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

