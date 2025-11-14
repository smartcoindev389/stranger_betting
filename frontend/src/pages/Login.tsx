import { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';

interface LoginProps {
  onAuthSuccess: (userId: string, hasUsername: boolean) => void;
}

declare global {
  interface Window {
    google?: any;
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { showNotification } = useNotification();

  // Initialize Google Sign-In
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    // Only load Google SDK if client ID is configured
    if (clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID' && clientId !== '') {
      // Load Google Identity Services
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
          });
        }
      };
      document.head.appendChild(script);
    }

    // Load Facebook SDK only if App ID is configured
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (appId && appId !== 'YOUR_FACEBOOK_APP_ID' && appId !== '') {
      window.fbAsyncInit = () => {
        if (window.FB) {
          window.FB.init({
            appId: appId,
            cookie: true,
            xfbml: true,
            version: 'v18.0',
          });
        }
      };

      const fbScript = document.createElement('script');
      fbScript.id = 'facebook-jssdk';
      fbScript.src = 'https://connect.facebook.net/en_US/sdk.js';
      fbScript.async = true;
      fbScript.defer = true;
      document.head.appendChild(fbScript);
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleGoogleCallback = async (response: any) => {
    if (!response.credential) {
      showNotification('Google authentication failed', 'error');
      setLoading(null);
      return;
    }

    setLoading('google');
    try {
      // Send the credential token to backend for verification
      const authResponse = await fetch('http://localhost:3001/api/auth/oauth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      if (!authResponse.ok) {
        const error = await authResponse.json();
        throw new Error(error.error || 'Authentication failed');
      }

      const data = await authResponse.json();
      
      if (data.banned) {
        showNotification('Your account has been banned', 'error');
        setLoading(null);
        return;
      }

      onAuthSuccess(data.userId, data.hasUsername);
    } catch (error: any) {
      console.error('Google login error:', error);
      showNotification(error.message || 'Failed to authenticate with Google', 'error');
      setLoading(null);
    }
  };

  const handleGoogleLogin = () => {
    if (!window.google) {
      showNotification('Google Sign-In is not loaded. Please refresh the page.', 'error');
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID' || clientId === '') {
      showNotification(
        'Google OAuth is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file. See README_OAUTH_SETUP.md for instructions.',
        'error'
      );
      return;
    }

    setLoading('google');
    
    try {
      // Use the prompt method which shows the one-tap sign-in
      // This will trigger the handleGoogleCallback when user signs in
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If one-tap is not available, use the button flow
          // Create a temporary button and trigger it
          const button = document.createElement('div');
          button.id = 'google-signin-button';
          document.body.appendChild(button);
          
          window.google.accounts.id.renderButton(button, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            width: 300,
          });

          // Trigger click after a short delay
          setTimeout(() => {
            const googleButton = button.querySelector('div[role="button"]') as HTMLElement;
            if (googleButton) {
              googleButton.click();
            } else {
              showNotification('Failed to initialize Google Sign-In. Please try again.', 'error');
              setLoading(null);
              document.body.removeChild(button);
            }
          }, 100);
        }
      });
    } catch (error: any) {
      console.error('Google login error:', error);
      showNotification('Failed to initialize Google Sign-In. Please check your configuration.', 'error');
      setLoading(null);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB) {
      showNotification('Facebook SDK is not loaded. Please refresh the page.', 'error');
      return;
    }

    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId || appId === 'YOUR_FACEBOOK_APP_ID' || appId === '') {
      showNotification(
        'Facebook OAuth is not configured. Please set VITE_FACEBOOK_APP_ID in your .env file. See README_OAUTH_SETUP.md for instructions.',
        'error'
      );
      return;
    }

    setLoading('facebook');
    window.FB.login(
      async (response: any) => {
        if (response.authResponse) {
          try {
            // Send access token to backend for verification
            const authResponse = await fetch('http://localhost:3001/api/auth/oauth/facebook', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                accessToken: response.authResponse.accessToken,
              }),
            });

            if (!authResponse.ok) {
              const error = await authResponse.json();
              throw new Error(error.error || 'Authentication failed');
            }

            const data = await authResponse.json();
            
            if (data.banned) {
              showNotification('Your account has been banned', 'error');
              return;
            }

            onAuthSuccess(data.userId, data.hasUsername);
          } catch (error: any) {
            console.error('Facebook login error:', error);
            showNotification(error.message || 'Failed to authenticate with Facebook', 'error');
          } finally {
            setLoading(null);
          }
        } else {
          showNotification('Facebook authentication was cancelled', 'info');
          setLoading(null);
        }
      },
      { scope: 'email,public_profile' }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome</h1>
          <p className="text-gray-600">Sign in to start playing</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                Continue with Google
              </>
            )}
          </button>

          <button
            onClick={handleFacebookLogin}
            disabled={loading !== null || !import.meta.env.VITE_FACEBOOK_APP_ID || import.meta.env.VITE_FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID'}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#1877F2] text-white rounded-xl font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!import.meta.env.VITE_FACEBOOK_APP_ID || import.meta.env.VITE_FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID' ? 'Facebook OAuth not configured' : ''}
          >
            {loading === 'facebook' ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Continue with Facebook
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

