import { Gamepad2, LogOut } from 'lucide-react';
import { clearAuth } from '../utils/api';
import { disconnectSocket } from '../utils/socket';
import { useDialog } from '../hooks/useDialog';

interface HeaderProps {
  username?: string;
  isConnected: boolean;
  onLogout?: () => void;
}

export default function Header({ username, isConnected, onLogout }: HeaderProps) {
  // Get username from localStorage if not provided
  const displayUsername = username || localStorage.getItem('username') || 'Guest';
  const { showConfirm, DialogComponent } = useDialog();

  const handleLogout = async () => {
    const confirmed = await showConfirm('Are you sure you want to logout?', {
      type: 'warning',
      title: 'Logout',
      confirmText: 'Logout',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      // Clear authentication data
      clearAuth();
      
      // Disconnect socket
      disconnectSocket();
      
      // Call onLogout callback if provided
      if (onLogout) {
        onLogout();
      } else {
        // Default: redirect to login
        window.location.href = '/';
      }
    }
  };

  return (
    <>
    <header className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              SkillPlay
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">{displayUsername}</span>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
              {displayUsername !== 'Guest' && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              )}
          </div>
        </div>
      </div>
    </header>
      {DialogComponent}
    </>
  );
}
