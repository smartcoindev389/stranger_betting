import { useState, useEffect } from 'react';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import Lobby from './pages/Lobby';
import { connectSocket, disconnectSocket, sendChatMessage, getSocket, connectUser } from './utils/socket';
import { startVideo, closePeerConnection } from './utils/webrtc';

type Page = 'home' | 'game-room' | 'lobby';

interface NavigationData {
  gameType?: 'tic-tac-toe' | 'checkers' | 'chess';
  keyword?: string;
  roomId?: string;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isConnected, setIsConnected] = useState(false);
  const [currentGameType, setCurrentGameType] = useState<'tic-tac-toe' | 'checkers' | 'chess'>('tic-tac-toe');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

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
      {currentPage === 'home' && (
        <Home onNavigate={handleNavigate} isConnected={isConnected} onUserConnect={handleUserConnect} />
      )}
      {currentPage === 'game-room' && (
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
      {currentPage === 'lobby' && (
        <Lobby onNavigate={handleNavigate} isConnected={isConnected} />
      )}
    </>
  );
}

export default App;
