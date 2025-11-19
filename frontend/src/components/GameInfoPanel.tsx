import { Users, Clock, Trophy } from 'lucide-react';
import ReportUser from './ReportUser';

interface Player {
  id: string;
  username: string;
}

interface GameInfoPanelProps {
  gameType: 'tic-tac-toe' | 'checkers' | 'chess';
  players: Player[];
  gameState: any;
  playerTeam: string;
  isMyTurn: boolean;
  gameOver: boolean;
  currentUserId?: string;
}

export default function GameInfoPanel({
  gameType,
  players,
  gameState,
  playerTeam,
  isMyTurn,
  gameOver,
  currentUserId,
}: GameInfoPanelProps) {
  const getGameName = () => {
    switch (gameType) {
      case 'tic-tac-toe':
        return 'Tic-Tac-Toe';
      case 'checkers':
        return 'Checkers';
      case 'chess':
        return 'Chess';
      default:
        return 'Game';
    }
  };

  const getPlayerDisplayName = (player: Player, index: number) => {
    if (gameType === 'tic-tac-toe') {
      return `${player.username} (${index === 0 ? 'X' : 'O'})`;
    } else if (gameType === 'checkers') {
      return `${player.username} (${index === 0 ? 'Player 1' : 'Player 2'})`;
    } else if (gameType === 'chess') {
      return `${player.username} (${index === 0 ? 'White' : 'Black'})`;
    }
    return player.username;
  };

  const getOpponentUsername = () => {
    if (!currentUserId || players.length < 2) return 'Opponent';
    const opponent = players.find((p) => p.id !== currentUserId);
    return opponent?.username || 'Opponent';
  };

  const getGameStatus = () => {
    // Check if we have less than 2 players
    if (players.length < 2) {
      return 'Waiting for another player...';
    }
    if (!gameState) {
      return 'Waiting for game to start...';
    }
    if (gameOver) {
      if (gameState?.winner || gameState?.winningTeam) {
        const winner = gameState.winner || gameState.winningTeam;
        const opponentUsername = getOpponentUsername();
        return `Game Over - ${winner === playerTeam ? 'You Win!' : `${opponentUsername} Wins!`}`;
      }
      if (gameState?.isDraw) {
        return 'Game Over - Draw!';
      }
      return 'Game Over';
    }
    if (isMyTurn) {
      return 'Your Turn';
    }
    const opponentUsername = getOpponentUsername();
    return `${opponentUsername}'s Turn`;
  };

  const getCurrentPlayerInfo = () => {
    if (!gameState) return null;
    
    if (gameType === 'tic-tac-toe') {
      return `Current Player: ${gameState.currentPlayer}`;
    } else if (gameType === 'checkers') {
      return `Current Player: ${gameState.currentPlayer === 'player1' ? 'Player 1' : 'Player 2'}`;
    } else if (gameType === 'chess') {
      return `Current Team: ${gameState.currentTeam === 'w' ? 'White' : 'Black'}`;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">{getGameName()}</h3>
      </div>

      {/* Game Status */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <p className="font-semibold text-gray-800">{getGameStatus()}</p>
        </div>
        {gameState && getCurrentPlayerInfo() && (
          <p className="text-sm text-gray-600 mt-1">{getCurrentPlayerInfo()}</p>
        )}
        {gameType === 'chess' && gameState?.totalTurns && (
          <p className="text-xs text-gray-500 mt-1">Turn: {gameState.totalTurns}</p>
        )}
        {players.length < 2 && (
          <p className="text-xs text-gray-500 mt-2 italic">
            Moves disabled until both players join
          </p>
        )}
      </div>

      {/* Players */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold text-gray-800">Players</h4>
        </div>
        <div className="space-y-3">
          {players.map((player, index) => {
            const isCurrentPlayer = playerTeam && (
              (gameType === 'tic-tac-toe' && playerTeam === (index === 0 ? 'X' : 'O')) ||
              (gameType === 'checkers' && playerTeam === (index === 0 ? 'player1' : 'player2')) ||
              (gameType === 'chess' && playerTeam === (index === 0 ? 'w' : 'b'))
            );
            
            return (
              <div
                key={player.id}
                className={`p-3 rounded-lg border-2 ${
                  isCurrentPlayer
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-800">
                    {getPlayerDisplayName(player, index)}
                  </p>
                  <div className="flex items-center gap-2">
                    {isCurrentPlayer && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                    {!isCurrentPlayer && currentUserId && player.id !== currentUserId && (
                      <ReportUser
                        reportedUserId={player.id}
                        reportedUsername={player.username}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Info */}
      {gameState && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p>Game Type: {getGameName()}</p>
            {gameType === 'chess' && gameState?.totalTurns && (
              <p>Total Turns: {gameState.totalTurns}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

