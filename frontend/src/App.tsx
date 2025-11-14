import { useState, useEffect } from 'react';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import Lobby from './pages/Lobby';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import { connectSocket, disconnectSocket, sendChatMessage, getSocket, connectUser, setNotificationHandler } from './utils/socket';
import { startVideo, closePeerConnection } from './utils/webrtc';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import NotificationContainer from './components/Notification';

type Page = 'home' | 'game-room' | 'lobby' | 'login' | 'auth-callback';

interface NavigationData {
  gameType?: 'tic-tac-toe' | 'checkers' | 'chess';
  keyword?: string;
  roomId?: string;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [isConnected, setIsConnected] = useState(false);
  const [currentGameType, setCurrentGameType] = useState<'tic-tac-toe' | 'checkers' | 'chess'>('tic-tac-toe');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const { notifications, removeNotification, showNotification } = useNotification();

  useEffect(() => {
    // Set up notification handler for socket errors
    setNotificationHandler((message, type = 'error') => {
      showNotification(message, type);
    });
  }, [showNotification]);

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connected', (data: { userId: string; username: string }) => {
      console.log('User connected:', data);
      setUsername(data.username);
      setUserId(data.userId);
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  const handleNavigate = (page: string, data?: NavigationData) => {
    setCurrentPage(page as Page);
    if (data?.gameType) {
      setCurrentGameType(data.gameType);
    }
    if (data?.roomId) {
      setCurrentRoomId(data.roomId);
    }
  };

  const handleAuthSuccess = (authUserId: string, hasUsername: boolean) => {
    setUserId(authUserId);
    if (hasUsername) {
      // User already has username, connect via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('user_connect', { userId: authUserId });
        socket.once('connected', (data: { userId: string; username: string }) => {
          setUsername(data.username);
          setCurrentPage('home');
        });
      }
    } else {
      // User needs to set username
      setPendingUserId(authUserId);
      setCurrentPage('auth-callback');
    }
  };

  const handleUsernameSet = (authUserId: string) => {
    setUserId(authUserId);
    setPendingUserId(null);
    setCurrentPage('home');
  };

  const handleUserConnect = (userName: string) => {
    console.log('Connecting user:', userName);
    connectUser(userName);
  };

  const handleSendMessage = (message: string) => {
    console.log('App: Sending message to room:', currentRoomId, 'Message:', message);
    sendChatMessage(currentRoomId, message);
  };

  const handleStartVideo = async () => {
    try {
      await startVideo();
      console.log('Video started successfully');
    } catch (error) {
      console.error('Failed to start video:', error);
    }
  };

  const handleEndCall = () => {
    closePeerConnection();
    console.log('Call ended');
  };

  const handleRematch = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('rematch_request', { roomId: currentRoomId });
    }
    console.log('Rematch requested');
  };

  const handleExitRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_room', { roomId: currentRoomId });
    }
    setCurrentPage('home');
    console.log('Exited room');
  };

  return (
    <>
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
      {currentPage === 'login' && (
        <Login onAuthSuccess={handleAuthSuccess} />
      )}
      {currentPage === 'auth-callback' && pendingUserId && (
        <AuthCallback userId={pendingUserId} onUsernameSet={handleUsernameSet} />
      )}
      {currentPage === 'home' && userId && (
        <Home onNavigate={handleNavigate} isConnected={isConnected} onUserConnect={handleUserConnect} />
      )}
      {currentPage === 'game-room' && userId && (
        <GameRoom
          gameType={currentGameType}
          roomId={currentRoomId}
          userId={userId}
          onNavigate={handleNavigate}
          isConnected={isConnected}
          onSendMessage={handleSendMessage}
          onStartVideo={handleStartVideo}
          onEndCall={handleEndCall}
          onRematch={handleRematch}
          onExitRoom={handleExitRoom}
        />
      )}
      {currentPage === 'lobby' && userId && (
        <Lobby onNavigate={handleNavigate} isConnected={isConnected} />
      )}
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;
