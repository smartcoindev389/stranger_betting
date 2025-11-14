import { io, Socket } from 'socket.io-client';

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
    socket.emit('player_move', { gameType, move });
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
