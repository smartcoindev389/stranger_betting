import { useState, useEffect } from 'react';
import { ArrowLeft, QrCode, Copy, Check, Wallet } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import Header from '../components/Header';

interface DepositProps {
  userId?: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
}

export default function Deposit({ userId, onNavigate, isConnected }: DepositProps) {
  const { showNotification } = useNotification();
  const [balance, setBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [pixEnabled, setPixEnabled] = useState<boolean | null>(null); // null = checking, true = enabled, false = disabled

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const currentUserId = userId || localStorage.getItem('userId') || '';

  useEffect(() => {
    if (currentUserId) {
      checkPixStatus();
      fetchBalance();
    }

    // Listen for real-time balance updates via socket
    const socket = (window as any).socket;
    if (socket) {
      const handleBalanceUpdate = (data: { userId: string; balance: number }) => {
        if (data.userId === currentUserId || !currentUserId) {
          setBalance(data.balance);
        }
      };

      const handleDepositStatus = (data: {
        transactionId: string;
        status: string;
        amount?: number;
        newBalance?: number;
      }) => {
        if (data.transactionId === transactionId) {
          if (data.status === 'completed') {
            showNotification('Deposit completed successfully!', 'success');
            setQrCode(null);
            setQrCodeBase64(null);
            setTransactionId(null);
            if (data.newBalance !== undefined) {
              setBalance(data.newBalance);
            } else {
              fetchBalance();
            }
          } else if (data.status === 'failed') {
            showNotification('Deposit failed', 'error');
            setQrCode(null);
            setQrCodeBase64(null);
            setTransactionId(null);
          }
        }
      };

      socket.on('balance_updated', handleBalanceUpdate);
      socket.on('deposit_status', handleDepositStatus);

      return () => {
        socket.off('balance_updated', handleBalanceUpdate);
        socket.off('deposit_status', handleDepositStatus);
      };
    }
  }, [currentUserId, transactionId]);

  const checkPixStatus = async () => {
    try {
      const { authenticatedFetch } = await import('../utils/api');
      const response = await authenticatedFetch(`${API_BASE}/api/pix/status`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pix status check response:', data);
        const enabled = data.enabled || data.configured;
        console.log('Pix enabled:', enabled);
        setPixEnabled(enabled);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Pix status check failed:', response.status, errorData);
        setPixEnabled(false);
      }
    } catch (error) {
      console.error('Error checking Pix status:', error);
      // If it's an auth error, still try to show the form (maybe token expired)
      // But log it for debugging
      setPixEnabled(false);
    }
  };

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

  const handleDeposit = async () => {
    if (!currentUserId) {
      showNotification('Please log in to make a deposit', 'error');
      return;
    }
    
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || !amountNum || amountNum < 1) {
      showNotification('Minimum deposit is R$ 1.00', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const { authenticatedFetch } = await import('../utils/api');
      const requestBody = { amount: amountNum };
      console.log('Sending deposit request:', requestBody, 'userId:', currentUserId);
      
      const response = await authenticatedFetch(`${API_BASE}/api/pix/deposit/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.status === 503) {
        showNotification('Pix integration is not available yet', 'info');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMsg = data.error_message || data.error || `Failed to create deposit request (${response.status})`;
        console.error('Deposit request failed:', response.status, data);
        showNotification(errorMsg, 'error');
        setIsLoading(false);
        return;
      }

      setQrCode(data.qrCode);
      setQrCodeBase64(data.qrCodeBase64);
      setQrExpiresAt(data.expiresAt);
      setTransactionId(data.transactionId);
      showNotification('QR Code generated. Scan to complete payment.', 'success');
      
      // Poll for status
      pollDepositStatus(data.transactionId);
    } catch (error) {
      showNotification('Error creating deposit request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const pollDepositStatus = async (txId: string) => {
    if (!currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const { authenticatedFetch } = await import('../utils/api');
        const response = await authenticatedFetch(
          `${API_BASE}/api/pix/deposit/status/${txId}?userId=${currentUserId}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed') {
            clearInterval(interval);
            showNotification('Deposit completed successfully!', 'success');
            setQrCode(null);
            setQrCodeBase64(null);
            setTransactionId(null);
            fetchBalance();
          } else if (data.status === 'failed') {
            clearInterval(interval);
            showNotification(data.errorMessage || 'Deposit failed', 'error');
            setQrCode(null);
            setQrCodeBase64(null);
            setTransactionId(null);
          }
        }
      } catch (error) {
        console.error('Error polling deposit status:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showNotification('Copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Show loading/disabled state
  if (pixEnabled === null) {
    // Still checking
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <Header isConnected={isConnected} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Checking Pix Status...</h2>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </main>
      </div>
    );
  }

  if (pixEnabled === false) {
    // Show error but allow user to try anyway (the actual deposit will show proper error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <Header isConnected={isConnected} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Wallet className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Pix Status Check Failed</h3>
                <p className="text-sm text-yellow-800 mb-4">
                  Unable to verify Pix integration status. This might be a temporary issue.
                  You can still try to create a deposit - the system will show a proper error if Pix is not configured.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={checkPixStatus}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  >
                    Retry Check
                  </button>
                  <button
                    onClick={() => setPixEnabled(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Try Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Show the deposit form anyway */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => onNavigate('home')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <Wallet className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Deposit Funds</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">Current Balance:</span>
                    <span className="text-xl font-bold text-green-600">
                      R$ {balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {qrCode ? (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                  Scan QR Code to Complete Payment
                </h3>
                {qrCodeBase64 && (
                  <div className="mb-6">
                    <img
                      src={qrCodeBase64}
                      alt="Pix QR Code"
                      className="mx-auto w-72 h-72 border-4 border-gray-300 rounded-lg shadow-lg"
                    />
                  </div>
                )}
                <div className="bg-white p-6 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 mb-3 font-semibold">Pix Copy & Paste Code:</p>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-xs break-all p-4 bg-gray-100 rounded-lg border-2 border-gray-200">
                      {qrCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(qrCode)}
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {qrExpiresAt && (
                  <p className="text-sm text-gray-600 mb-6">
                    Expires at: {new Date(qrExpiresAt).toLocaleString()}
                  </p>
                )}
                <button
                  onClick={() => {
                    setQrCode(null);
                    setQrCodeBase64(null);
                    setTransactionId(null);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Amount (BRL)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-semibold">
                      R$
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg font-semibold"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum: R$ 1.00</p>
                </div>
                <button
                  onClick={handleDeposit}
                  disabled={isLoading || !depositAmount || parseFloat(depositAmount) < 1}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  <QrCode className="w-6 h-6" />
                  {isLoading ? 'Generating QR Code...' : 'Generate Pix QR Code'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

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
              <Wallet className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Deposit Funds</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-600">Current Balance:</span>
                  <span className="text-xl font-bold text-green-600">
                    R$ {balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {qrCode ? (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                Scan QR Code to Complete Payment
              </h3>
              {qrCodeBase64 && (
                <div className="mb-6">
                  <img
                    src={qrCodeBase64}
                    alt="Pix QR Code"
                    className="mx-auto w-72 h-72 border-4 border-gray-300 rounded-lg shadow-lg"
                  />
                </div>
              )}
              <div className="bg-white p-6 rounded-lg mb-6">
                <p className="text-sm text-gray-600 mb-3 font-semibold">Pix Copy & Paste Code:</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs break-all p-4 bg-gray-100 rounded-lg border-2 border-gray-200">
                    {qrCode}
                  </code>
                  <button
                    onClick={() => copyToClipboard(qrCode)}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {qrExpiresAt && (
                <p className="text-sm text-gray-600 mb-6">
                  Expires at: {new Date(qrExpiresAt).toLocaleString()}
                </p>
              )}
              <button
                onClick={() => {
                  setQrCode(null);
                  setQrCodeBase64(null);
                  setTransactionId(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount (BRL)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Minimum: R$ 1.00</p>
              </div>
              <button
                onClick={handleDeposit}
                disabled={isLoading || !depositAmount || parseFloat(depositAmount) < 1}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                <QrCode className="w-6 h-6" />
                {isLoading ? 'Generating QR Code...' : 'Generate Pix QR Code'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

