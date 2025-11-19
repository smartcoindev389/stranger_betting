import { useState, useEffect } from 'react';
import { emitMove } from '../utils/socket';

interface TicTacToeBoardProps {
  gameState: {
    board: (string | null)[];
    currentPlayer: string;
    winner: string | null;
    isDraw: boolean;
  };
  playerTeam: string;
  isMyTurn: boolean;
  players?: Array<{ id: string; username: string }>;
  currentUserId?: string;
}

export default function TicTacToeBoard({ gameState, playerTeam, isMyTurn, players, currentUserId }: TicTacToeBoardProps) {
  const [localBoard, setLocalBoard] = useState<(string | null)[]>(gameState.board);

  useEffect(() => {
    setLocalBoard(gameState.board);
  }, [gameState]);

  const handleSquareClick = (index: number) => {
    console.log('Square clicked:', index, 'isMyTurn:', isMyTurn, 'playerTeam:', playerTeam);
    if (!isMyTurn || gameState.winner || gameState.isDraw || localBoard[index] !== null) {
      console.log('Move blocked:', { isMyTurn, winner: gameState.winner, isDraw: gameState.isDraw, cellValue: localBoard[index] });
      return;
    }

    // Send move to server
    console.log('Sending move to server:', { index, gameType: 'tic_tac_toe' });
    emitMove('tic_tac_toe', { index });
  };

  const getSquareContent = (value: string | null) => {
    if (value === 'X') return '❌';
    if (value === 'O') return '⭕';
    return '';
  };

  const getOpponentUsername = () => {
    if (!currentUserId || !players || players.length < 2) return 'Opponent';
    const opponent = players.find((p) => p.id !== currentUserId);
    return opponent?.username || 'Opponent';
  };

  const getStatusMessage = () => {
    const opponentUsername = getOpponentUsername();
    if (gameState.winner) {
      return `Winner: ${gameState.winner === playerTeam ? 'You' : opponentUsername}!`;
    }
    if (gameState.isDraw) {
      return 'Draw!';
    }
    if (!isMyTurn && !gameState.winner && !gameState.isDraw) {
      // Check if it's because we're waiting for a player
      if (isMyTurn === false) {
        return `${opponentUsername}'s turn`;
      }
    }
    if (isMyTurn) {
      return 'Your turn';
    }
    return `${opponentUsername}'s turn`;
  };

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="mb-4 text-center">
        <p className="text-xl font-semibold text-gray-800">{getStatusMessage()}</p>
        <p className="text-sm text-gray-600 mt-1">You are: {playerTeam}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-lg">
        {localBoard.map((value, index) => (
          <button
            key={index}
            onClick={() => handleSquareClick(index)}
            disabled={!isMyTurn || value !== null || gameState.winner !== null || gameState.isDraw}
            className={`
              w-24 h-24 bg-white rounded-lg flex items-center justify-center text-4xl
              transition-all duration-200
              ${value === null && isMyTurn && !gameState.winner && !gameState.isDraw
                ? 'hover:bg-gray-100 cursor-pointer active:scale-95'
                : 'cursor-not-allowed opacity-60'
              }
              ${value !== null ? 'bg-blue-50' : ''}
            `}
          >
            {getSquareContent(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

