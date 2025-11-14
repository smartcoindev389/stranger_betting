import { useState, useEffect, useRef } from 'react';
import { RotateCcw, LogOut } from 'lucide-react';
import Header from '../components/Header';
import GameBoard from '../components/GameBoard';
import ChatPanel from '../components/ChatPanel';
import VideoPanel from '../components/VideoPanel';
import { getSocket } from '../utils/socket';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
}

interface GameRoomProps {
  gameType: 'tic-tac-toe' | 'checkers' | 'chess';
  roomId?: string;
  userId?: string;
  onNavigate: (page: string) => void;
  isConnected: boolean;
  onSendMessage: (message: string) => void;
  onStartVideo: () => void;
  onEndCall: () => void;
  onRematch: () => void;
  onExitRoom: () => void;
}

export default function GameRoom({
  gameType,
  roomId,
  userId: propUserId,
  onNavigate,
  isConnected,
  onSendMessage,
  onStartVideo,
  onEndCall,
  onRematch,
  onExitRoom,
}: GameRoomProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'System',
      text: 'Welcome to the game room! Good luck!',
      timestamp: new Date(),
      isOwn: false,
    },
  ]);
  const [gameState, setGameState] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isWaiting, setIsWaiting] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [userId, setUserId] = useState<string>(propUserId || '');
  const [localRoomId, setLocalRoomId] = useState<string>(roomId || '');
  const gameStateRef = useRef<any>(null); // Ref to track gameState for event handlers

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.error('Socket not available in GameRoom');
      return;
    }

    console.log('GameRoom useEffect - roomId:', roomId, 'gameType:', gameType);
    
    // Initialize gameStateRef from current gameState
    gameStateRef.current = gameState;

    // Get userId from socket connected event or prop
    const handleConnected = (data: { userId: string; username: string }) => {
      console.log('GameRoom: User connected:', data);
      setUserId(data.userId);
    };
    
    socket.on('connected', handleConnected);
    
    // Use prop userId if available
    if (propUserId && !userId) {
      setUserId(propUserId);
    }
    
    // Initialize localRoomId from prop if available
    if (roomId && !localRoomId) {
      setLocalRoomId(roomId);
    }

    // Listen for game start
    const handleGameStart = (data: any) => {
      console.log('✅ Game started event received:', data);
      console.log('Current roomId prop:', roomId, 'localRoomId:', localRoomId, 'Event roomId:', data.roomId);
      
      // Accept the event if:
      // 1. roomId matches (exact match)
      // 2. localRoomId matches (if prop wasn't set)
      // 3. Neither is set yet (first time receiving - accept any)
      const currentRoomId = roomId || localRoomId;
      const shouldAccept = !currentRoomId || data.roomId === currentRoomId || data.roomId === roomId;
      
      if (shouldAccept) {
        console.log('✅ Accepting game_start - Setting game state and players');
        // Update localRoomId if not set
        if (data.roomId && !localRoomId) {
          console.log('Setting localRoomId to:', data.roomId);
          setLocalRoomId(data.roomId);
        }
        // IMPORTANT: Set game state and waiting state FIRST to prevent race conditions
        gameStateRef.current = data.gameState; // Update ref immediately
        setGameState(data.gameState);
        setPlayers(data.players || []);
        setIsWaiting(false); // Always set to false when game starts
        setGameOver(false);
        console.log('✅ Game state set, isWaiting set to false, players:', data.players?.length || 0);
      } else {
        console.log('❌ Ignoring game_start - roomId mismatch. Current:', currentRoomId, 'Event:', data.roomId);
      }
    };

    // Listen for waiting for player
    const handleWaiting = (data: any) => {
      console.log('⏳ Waiting for player event received:', data);
      console.log('Current roomId:', roomId, 'localRoomId:', localRoomId, 'Event roomId:', data.roomId);
      // Accept if roomId matches OR if roomId is not set yet
      const currentRoomId = roomId || localRoomId;
      if (!currentRoomId || data.roomId === currentRoomId || data.roomId === roomId) {
        const playerCount = data.players?.length || 0;
        
        // Update players first
        setPlayers(data.players || []);
        
        // Update local roomId if not set
        if (data.roomId && !localRoomId) {
          setLocalRoomId(data.roomId);
        }
        
        // CRITICAL: If we have 2 players, NEVER set waiting to true
        // Game should start immediately, so hide waiting notification
        if (playerCount >= 2) {
          console.log('2 players present - setting isWaiting to false immediately');
          setIsWaiting(false);
          return; // Don't process further
        }
        
        // Only set waiting if:
        // 1. We don't already have a game state (prevent race condition)
        // 2. AND we have less than 2 players
        if (!gameStateRef.current && playerCount < 2) {
          console.log('Setting waiting state to true (no gameState, players:', playerCount, ')');
          setIsWaiting(true);
        } else {
          console.log('Ignoring waiting_for_player - game already started');
        }
      }
    };

    // Listen for move updates
    const handleMoveUpdate = (data: any) => {
      console.log('Move update:', data);
      gameStateRef.current = data.gameState; // Update ref
      setGameState(data.gameState);
      setIsWaiting(false);
    };

    // Listen for game over
    const handleGameOver = (data: any) => {
      console.log('Game over:', data);
      setGameOver(true);
      setGameState(data.gameState);
    };

    // Listen for new match (rematch)
    const handleNewMatch = (data: any) => {
      console.log('New match started:', data);
      const currentRoomId = roomId || localRoomId;
      if (!currentRoomId || data.roomId === currentRoomId || data.roomId === roomId) {
        setGameState(data.gameState);
        setGameOver(false);
        setIsWaiting(false);
      }
    };

    // Listen for chat history (when rejoining)
    const handleChatHistory = (data: any) => {
      console.log('Chat history received:', data);
      console.log('Current userId:', userId, 'propUserId:', propUserId);
      if (data.messages && Array.isArray(data.messages)) {
        const currentUserId = userId || propUserId;
        const historyMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          sender: msg.username || 'Unknown',
          text: msg.message,
          timestamp: new Date(msg.timestamp || Date.now()),
          isOwn: msg.userId === currentUserId,
        }));
        // Replace messages with history (but keep system message if exists)
        const systemMessage = messages.find(msg => msg.sender === 'System');
        setMessages(systemMessage ? [systemMessage, ...historyMessages] : historyMessages);
        console.log('Loaded chat history:', historyMessages.length, 'messages');
      }
    };

    // Listen for chat messages
    const handleChatMessage = (data: any) => {
      console.log('Chat message received:', data);
      // Check if this message is from the current user (already added locally)
      const isOwnMessage = data.userId === userId;
      
      // Only add if it's not our own message (we already added it locally)
      if (!isOwnMessage) {
        const newMessage: Message = {
          id: data.id || Date.now().toString(),
          sender: data.username || 'Unknown',
          text: data.message,
          timestamp: new Date(data.timestamp || Date.now()),
          isOwn: false,
        };
        setMessages((prev) => {
          // Check if message already exists (prevent duplicates)
          const exists = prev.some(msg => msg.id === data.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      }
    };

    // Listen for player left
    const handlePlayerLeft = () => {
      alert('Opponent left the game');
      setIsWaiting(true);
    };

    // Listen for player joined (when someone joins your waiting room)
    const handlePlayerJoined = (data: any) => {
      console.log('Player joined:', data);
      console.log('Current roomId:', roomId, 'localRoomId:', localRoomId, 'Event roomId:', data.roomId);
      // Accept if roomId matches OR if roomId is not set yet
      const currentRoomId = roomId || localRoomId;
      if (!currentRoomId || data.roomId === currentRoomId || data.roomId === roomId) {
        const playerCount = data.players?.length || 0;
        setPlayers(data.players || []);
        
        // Update local roomId if not set
        if (data.roomId && !localRoomId) {
          setLocalRoomId(data.roomId);
        }
        
        // CRITICAL: If we now have 2 players, immediately hide waiting notification
        // Game should start soon, so don't show "waiting" message
        if (playerCount >= 2) {
          console.log('Two players in room, setting isWaiting to false, waiting for game_start event...');
          setIsWaiting(false);
        }
      }
    };

    socket.on('game_start', handleGameStart);
    socket.on('waiting_for_player', handleWaiting);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('move_update', handleMoveUpdate);
    socket.on('game_over', handleGameOver);
    socket.on('new_match_start', handleNewMatch);
    socket.on('chat_history', handleChatHistory);
    socket.on('chat_message', handleChatMessage);
    socket.on('player_left', handlePlayerLeft);

    return () => {
      socket.off('game_start', handleGameStart);
      socket.off('waiting_for_player', handleWaiting);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('move_update', handleMoveUpdate);
      socket.off('game_over', handleGameOver);
      socket.off('new_match_start', handleNewMatch);
      socket.off('chat_history', handleChatHistory);
      socket.off('chat_message', handleChatMessage);
      socket.off('player_left', handlePlayerLeft);
      socket.off('connected', handleConnected);
    };
  }, [roomId, localRoomId, userId]);

  const handleSendMessage = (text: string) => {
    console.log('Sending chat message:', text);
    // Generate a temporary ID that we'll match when the server responds
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newMessage: Message = {
      id: tempId,
      sender: 'You',
      text,
      timestamp: new Date(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, newMessage]);
    onSendMessage(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <Header isConnected={isConnected} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isWaiting && !gameState && players.length > 0 && players.length < 2 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-yellow-800 font-semibold">
              Waiting for another player to join...
            </p>
            <p className="text-yellow-600 text-sm mt-1">
              {players.length}/2 players in room
            </p>
          </div>
        )}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!isWaiting && gameState ? (
              <GameBoard key={`board-${roomId || localRoomId}`} gameType={gameType} gameState={gameState} />
            ) : isWaiting ? (
              <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                  <div className="w-64 h-64 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-6xl">
                      {gameType === 'tic-tac-toe' ? '⭕' : gameType === 'checkers' ? '⚫' : '♟️'}
                    </span>
                  </div>
                  <p className="text-gray-600 font-medium">
                    {gameType === 'tic-tac-toe' && 'Tic-Tac-Toe Board'}
                    {gameType === 'checkers' && 'Checkers Board'}
                    {gameType === 'chess' && 'Chess Board'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">Waiting for game to start...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                  <p className="text-gray-600">Loading game...</p>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={onRematch}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <RotateCcw className="w-5 h-5" />
                Rematch
              </button>
              <button
                onClick={onExitRoom}
                className="flex-1 bg-gray-200 text-gray-900 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Exit Room
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <ChatPanel onSendMessage={handleSendMessage} messages={messages} />
            <VideoPanel onStartVideo={onStartVideo} onEndCall={onEndCall} />
          </div>
        </div>
      </main>
    </div>
  );
}
