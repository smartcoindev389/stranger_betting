import TicTacToeBoard from './TicTacToeBoard';
import CheckersBoard from './CheckersBoard';
import ChessBoard from './ChessBoard';

interface GameBoardProps {
  gameType: 'tic-tac-toe' | 'checkers' | 'chess';
  gameState?: any;
  playerTeam?: string;
  isMyTurn?: boolean;
}

export default function GameBoard({ gameType, gameState, playerTeam, isMyTurn }: GameBoardProps) {
  if (!gameState) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  const gameTypeMap: Record<string, string> = {
    'tic-tac-toe': 'tic_tac_toe',
    'checkers': 'checkers',
    'chess': 'chess',
  };

  const serverGameType = gameTypeMap[gameType] || gameType;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 min-h-[500px]">
      {gameType === 'tic-tac-toe' && (
        <TicTacToeBoard
          gameState={gameState}
          playerTeam={playerTeam || 'X'}
          isMyTurn={isMyTurn ?? false}
        />
      )}
      {gameType === 'checkers' && (
        <CheckersBoard
          gameState={gameState}
          playerTeam={playerTeam || 'player1'}
          isMyTurn={isMyTurn ?? false}
        />
      )}
      {gameType === 'chess' && (
        <ChessBoard
          gameState={gameState}
          playerTeam={playerTeam || 'w'}
          isMyTurn={isMyTurn ?? false}
        />
      )}
    </div>
  );
}
