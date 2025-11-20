import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNotification } from '../contexts/NotificationContext';

interface LoginProps {
  onAuthSuccess: (userId: string, username: string) => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { showNotification } = useNotification();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      const access_token = tokenResponse.access_token;
      
      try {
        const response = await fetch(`${API_URL}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ access_token }),
        });

        if (!response.ok) {
          const error = await response.json();
          // Handle banned users specifically
          if (error.banned || error.error?.toLowerCase().includes('banned')) {
            showNotification('Your account has been banned. Please contact support if you believe this is an error.', 'error');
            setGoogleLoading(false);
            return;
          }
          throw new Error(error.error || 'Authentication failed');
        }

        const data = await response.json();

        if (data.error) {
          showNotification(data.error || 'Authentication failed', 'error');
          setGoogleLoading(false);
          return;
        }

        if (!data.user || !data.token) {
          showNotification('Invalid response from server', 'error');
          setGoogleLoading(false);
          return;
        }

        // Store token and user info in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        localStorage.setItem('userType', data.userType);
        if (data.email) {
          localStorage.setItem('email', data.email);
        }

        // If admin login, redirect to admin panel
        if (data.userType === 'admin') {
          window.location.href = '/admin';
          return;
        }

        onAuthSuccess(data.userId, data.username);
      } catch (error: any) {
        console.error('Google login error:', error);
        showNotification(error.message || 'Failed to login with Google', 'error');
        setGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
      showNotification('Google sign-in failed. Please try again.', 'error');
      setGoogleLoading(false);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600">Sign in with Google to start playing</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleGoogleLogin()}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {googleLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-lg">Sign in with Google</span>
              </>
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
