import { useState } from 'react';
import { Circle, Square, Crown, Users, Hash } from 'lucide-react';
import Header from '../components/Header';
import { getSocket, connectSocket } from '../utils/socket';
import { useNotification } from '../contexts/NotificationContext';

interface HomeProps {
  onNavigate: (page: string, data?: { gameType?: string; keyword?: string; roomId?: string }) => void;
  isConnected: boolean;
  onUserConnect: (username: string) => void;
  username?: string;
  onLogout?: () => void;
  userId?: string;
}

export default function Home({ onNavigate, isConnected, onUserConnect, username: propUsername, onLogout, userId }: HomeProps) {
  const [keyword, setKeyword] = useState('');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const { showNotification } = useNotification();

  const games = [
    {
      id: 'tic-tac-toe',
      name: 'Tic-Tac-Toe',
      icon: Circle,
      color: 'from-blue-500 to-cyan-500',
      description: 'Classic 3x3 strategy game',
    },
    {
      id: 'checkers',
      name: 'Checkers',
      icon: Square,
      color: 'from-red-500 to-orange-500',
      description: 'Jump and capture pieces',
    },
    {
      id: 'chess',
      name: 'Chess',
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
      description: 'Strategic board game',
    },
  ];

  const handleSetUsername = () => {
    if (username.trim()) {
      console.log('Setting username:', username.trim());
      onUserConnect(username.trim());
      setIsUsernameSet(true);
    }
  };

  const handleRandomMatch = (gameType: string) => {
    if (!isUsernameSet) {
      showNotification('Please set your username first', 'warning');
      return;
    }
    setSelectedGame(gameType);
    // Convert game type format (tic-tac-toe -> tic_tac_toe)
    const backendGameType = gameType.replace(/-/g, '_');
    const socket = getSocket();
    if (socket) {
      console.log('Attempting to join random match for:', backendGameType);
      console.log('Socket connected:', socket.connected);
      console.log('Socket ID:', socket.id);
      
      // Set up event listeners before emitting
      const handleGameStart = (data: any) => {
        console.log('Game started:', data);
        socket.off('game_start', handleGameStart);
        socket.off('waiting_for_player', handleWaiting);
        socket.off('error', handleError);
        // Ensure roomId is passed
        if (data.roomId) {
          onNavigate('game-room', { gameType, roomId: data.roomId });
        }
      };
      
      const handleWaiting = (data: any) => {
        console.log('Waiting for player:', data);
        socket.off('game_start', handleGameStart);
        socket.off('waiting_for_player', handleWaiting);
        socket.off('error', handleError);
        // Ensure roomId is passed
        if (data.roomId) {
          onNavigate('game-room', { gameType, roomId: data.roomId });
        }
      };
      
      const handleError = (error: any) => {
        console.error('Error joining room:', error);
        showNotification(error.message || 'Failed to join room', 'error');
        socket.off('game_start', handleGameStart);
        socket.off('waiting_for_player', handleWaiting);
        socket.off('error', handleError);
      };
      
      socket.on('game_start', handleGameStart);
      socket.on('waiting_for_player', handleWaiting);
      socket.on('error', handleError);
      
      console.log('Emitting join_random with gameType:', backendGameType);
      socket.emit('join_random', { gameType: backendGameType });
    } else {
      console.error('Socket is null!');
      showNotification('Not connected to server. Please refresh the page.', 'error');
    }
  };

  const handleJoinByKeyword = () => {
    if (!isUsernameSet) {
      showNotification('Please set your username first', 'warning');
      return;
    }
    if (keyword.trim() && selectedGame) {
      const backendGameType = selectedGame.replace(/-/g, '_');
      const socket = getSocket();
      if (socket) {
        const handleGameStart = (data: any) => {
          console.log('Game started:', data);
          socket.off('game_start', handleGameStart);
          socket.off('waiting_for_player', handleWaiting);
          socket.off('error', handleError);
          onNavigate('game-room', { gameType: selectedGame, roomId: data.roomId });
        };
        
        const handleWaiting = (data: any) => {
          console.log('Waiting for player:', data);
          socket.off('game_start', handleGameStart);
          socket.off('waiting_for_player', handleWaiting);
          socket.off('error', handleError);
          onNavigate('game-room', { gameType: selectedGame, roomId: data.roomId });
        };
        
        const handleError = (error: any) => {
          console.error('Error joining room:', error);
          showNotification(error.message || 'Failed to join room', 'error');
          socket.off('game_start', handleGameStart);
          socket.off('waiting_for_player', handleWaiting);
          socket.off('error', handleError);
        };
        
        socket.on('game_start', handleGameStart);
        socket.on('waiting_for_player', handleWaiting);
        socket.on('error', handleError);
        
        socket.emit('join_keyword', { gameType: backendGameType, keyword: keyword.trim() });
      }
    }
  };

  if (!isUsernameSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <Header isConnected={isConnected} username={propUsername || username} onLogout={onLogout} userId={userId} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
                Welcome!
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Enter your username to get started
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleSetUsername()}
                />
                <button
                  onClick={handleSetUsername}
                  disabled={!username.trim() || !isConnected}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnected ? 'Continue' : 'Connecting...'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <Header isConnected={isConnected} userId={userId} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Play, Chat, and Compete
          </h2>
          <p className="text-xl text-gray-600">
            Join friends or challenge random opponents in real-time
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <div
                key={game.id}
                className={`bg-white rounded-2xl shadow-lg p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                  selectedGame === game.id ? 'ring-4 ring-blue-500 ring-offset-2' : ''
                }`}
                onClick={() => setSelectedGame(game.id)}
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${game.color} rounded-2xl flex items-center justify-center mb-4 mx-auto`}
                >
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  {game.name}
                </h3>
                <p className="text-gray-600 text-center text-sm">{game.description}</p>
              </div>
            );
          })}
        </div>

        {selectedGame && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">
                  Connect to Match
                </h3>
              </div>

              <button
                onClick={() => handleRandomMatch(selectedGame)}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl mb-6"
              >
                Play Random Match
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Hash className="w-6 h-6 text-gray-400" />
                  <h4 className="text-lg font-semibold text-gray-900">
                    Join by Keyword
                  </h4>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Enter room keyword..."
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinByKeyword()}
                  />
                  <button
                    onClick={handleJoinByKeyword}
                    disabled={!keyword.trim()}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('lobby')}
              className="w-full bg-white text-gray-900 py-4 rounded-xl font-semibold text-lg border-2 border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
            >
              View Active Rooms
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
