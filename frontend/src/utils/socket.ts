import { io, Socket } from 'socket.io-client';

// We'll export a function to set the notification handler
let notificationHandler: ((message: string, type?: 'error' | 'success' | 'info' | 'warning') => void) | null = null;

export const setNotificationHandler = (handler: (message: string, type?: 'error' | 'success' | 'info' | 'warning') => void) => {
  notificationHandler = handler;
};

const showNotification = (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'error') => {
  if (notificationHandler) {
    notificationHandler(message, type);
  } else {
    // Fallback to console if handler not set
    console.error('Notification:', message);
  }
};

let socket: Socket | null = null;

export const connectSocket = (url: string = 'http://localhost:3001'): Socket => {
  if (!socket) {
    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('Connected to server:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const emitMove = (gameType: string, move: unknown) => {
  if (socket) {
    console.log('emitMove called:', { gameType, move, socketConnected: socket.connected });
    socket.emit('player_move', { gameType, move });
    
    // Listen for error response
    socket.once('error', (error: any) => {
      console.error('Move error:', error);
      if (error.message) {
        showNotification(`Move failed: ${error.message}`, 'error');
      }
    });
  } else {
    console.error('Cannot emit move - socket is null');
    showNotification('Not connected to server. Please refresh the page.', 'error');
  }
};

export const sendChatMessage = (roomId: string, message: string) => {
  if (socket) {
    socket.emit('chat_message', { message });
  }
};

export const joinRandomMatch = (gameType: string, callback: (data: unknown) => void) => {
  if (socket) {
    socket.emit('join_random', { gameType });
    socket.once('game_start', callback);
    socket.once('waiting_for_player', callback);
  }
};

export const joinByKeyword = (keyword: string, gameType: string, callback: (data: unknown) => void) => {
  if (socket) {
    socket.emit('join_keyword', { gameType, keyword });
    socket.once('game_start', callback);
    socket.once('waiting_for_player', callback);
  }
};

export const connectUser = (username: string) => {
  if (socket) {
    console.log('Emitting user_connect with username:', username);
    socket.emit('user_connect', { username });
  } else {
    console.error('Cannot connect user - socket is null');
  }
};

export const requestRematch = (roomId: string) => {
  if (socket) {
    socket.emit('rematch_request');
  }
};

export const leaveRoom = (roomId: string) => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const onChatMessage = (callback: (data: { sender: string; message: string }) => void) => {
  if (socket) {
    socket.on('chat_message', callback);
  }
};

export const onGameUpdate = (callback: (data: unknown) => void) => {
  if (socket) {
    socket.on('game_update', callback);
  }
};

export const offChatMessage = () => {
  if (socket) {
    socket.off('chat_message');
  }
};

export const offGameUpdate = () => {
  if (socket) {
    socket.off('game_update');
  }
};

export const emitPawnPromotion = (position: { x: number; y: number }, promotionType: string) => {
  if (socket) {
    socket.emit('pawn_promotion', {
      position,
      promotionType,
      gameType: 'chess',
    });
  } else {
    console.error('Cannot emit promotion - socket is null');
  }
};
