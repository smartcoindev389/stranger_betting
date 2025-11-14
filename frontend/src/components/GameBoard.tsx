interface GameBoardProps {
  gameType: 'tic-tac-toe' | 'checkers' | 'chess';
  gameState?: any;
}

export default function GameBoard({ gameType, gameState }: GameBoardProps) {
  if (!gameState) {
    return null; // Don't render anything if no gameState
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center min-h-[500px]">
      <div className="text-center w-full">
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
        <p className="text-sm text-gray-500 mt-2">Game board will render here</p>
        <p className="text-xs text-gray-400 mt-4 break-all">Game State: {JSON.stringify(gameState).substring(0, 100)}...</p>
      </div>
    </div>
  );
}
