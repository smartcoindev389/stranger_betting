import { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface LoginProps {
  onAuthSuccess: (userId: string, username: string) => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const handleLogin = async () => {
    if (!username.trim()) {
      showNotification('Please enter a username', 'warning');
      return;
    }

    if (username.trim().length < 3 || username.trim().length > 20) {
      showNotification('Username must be between 3 and 20 characters', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          type: userType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await response.json();
      
      if (data.banned) {
        showNotification('Your account has been banned', 'error');
        setLoading(false);
        return;
      }

      // Store token and user info in localStorage
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        localStorage.setItem('userType', data.userType);
      }

      // If admin login, redirect to admin panel
      if (data.userType === 'admin') {
        window.location.href = '/admin';
        return;
      }

      onAuthSuccess(data.userId, data.username);
    } catch (error: any) {
      console.error('Login error:', error);
      showNotification(error.message || 'Failed to login', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600">Enter your username to start playing</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Login Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUserType('user')}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                  userType === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setUserType('admin')}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                  userType === 'admin'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleLogin()}
              placeholder="Enter username (3-20 characters)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={20}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {username.length}/20 characters
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={!username.trim() || username.trim().length < 3 || loading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Logging in...</span>
              </div>
            ) : (
              'Continue'
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
