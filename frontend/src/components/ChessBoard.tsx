import { useState, useEffect } from 'react';
import { emitMove } from '../utils/socket';

interface ChessPiece {
  type: string;
  team: string;
  position: { x: number; y: number };
  hasMoved: boolean;
}

interface ChessBoardProps {
  gameState: {
    pieces: ChessPiece[];
    totalTurns: number;
    currentTeam: string;
    winningTeam: string | null;
  };
  playerTeam: string;
  isMyTurn: boolean;
}

const PIECE_IMAGES: Record<string, Record<string, string>> = {
  w: {
    pawn: '♙',
    rook: '♖',
    knight: '♘',
    bishop: '♗',
    queen: '♕',
    king: '♔',
  },
  b: {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚',
  },
};

export default function ChessBoard({ gameState, playerTeam, isMyTurn }: ChessBoardProps) {
  const [selectedPiece, setSelectedPiece] = useState<ChessPiece | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    setSelectedPiece(null);
    setPossibleMoves([]);
  }, [gameState.currentTeam]);

  const getPieceAt = (x: number, y: number): ChessPiece | undefined => {
    return gameState.pieces.find(p => p.position.x === x && p.position.y === y);
  };

  const handleSquareClick = (x: number, y: number) => {
    if (!isMyTurn || gameState.winningTeam) return;

    const piece = getPieceAt(x, y);

    // If clicking on own piece, select it
    if (piece && piece.team === playerTeam) {
      setSelectedPiece(piece);
      calculatePossibleMoves(piece);
      return;
    }

    // If a piece is selected and clicking on empty square or opponent piece, try to move
    if (selectedPiece) {
      const move = { from: selectedPiece.position, to: { x, y } };
      emitMove('chess', move);
      setSelectedPiece(null);
      setPossibleMoves([]);
    }
  };

  const calculatePossibleMoves = (piece: ChessPiece) => {
    const moves: Array<{ x: number; y: number }> = [];
    const { type, position, team } = piece;

    // Simple move calculation (can be enhanced with full chess rules)
    switch (type) {
      case 'pawn':
        const direction = team === 'w' ? 1 : -1;
        // Forward move
        if (!getPieceAt(position.x, position.y + direction)) {
          moves.push({ x: position.x, y: position.y + direction });
          // Double move from starting position
          if (!piece.hasMoved && !getPieceAt(position.x, position.y + 2 * direction)) {
            moves.push({ x: position.x, y: position.y + 2 * direction });
          }
        }
        // Capture diagonally
        [-1, 1].forEach(dx => {
          const target = getPieceAt(position.x + dx, position.y + direction);
          if (target && target.team !== team) {
            moves.push({ x: position.x + dx, y: position.y + direction });
          }
        });
        break;

      case 'rook':
        // Horizontal and vertical moves
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          for (let i = 1; i < 8; i++) {
            const newX = position.x + dx * i;
            const newY = position.y + dy * i;
            if (newX < 0 || newX >= 8 || newY < 0 || newY >= 8) break;
            const target = getPieceAt(newX, newY);
            if (!target) {
              moves.push({ x: newX, y: newY });
            } else {
              if (target.team !== team) moves.push({ x: newX, y: newY });
              break;
            }
          }
        });
        break;

      case 'bishop':
        // Diagonal moves
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
          for (let i = 1; i < 8; i++) {
            const newX = position.x + dx * i;
            const newY = position.y + dy * i;
            if (newX < 0 || newX >= 8 || newY < 0 || newY >= 8) break;
            const target = getPieceAt(newX, newY);
            if (!target) {
              moves.push({ x: newX, y: newY });
            } else {
              if (target.team !== team) moves.push({ x: newX, y: newY });
              break;
            }
          }
        });
        break;

      case 'queen':
        // Combines rook and bishop moves
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
          for (let i = 1; i < 8; i++) {
            const newX = position.x + dx * i;
            const newY = position.y + dy * i;
            if (newX < 0 || newX >= 8 || newY < 0 || newY >= 8) break;
            const target = getPieceAt(newX, newY);
            if (!target) {
              moves.push({ x: newX, y: newY });
            } else {
              if (target.team !== team) moves.push({ x: newX, y: newY });
              break;
            }
          }
        });
        break;

      case 'king':
        // One square in any direction
        [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dx, dy]) => {
          const newX = position.x + dx;
          const newY = position.y + dy;
          if (newX >= 0 && newX < 8 && newY >= 0 && newY < 8) {
            const target = getPieceAt(newX, newY);
            if (!target || target.team !== team) {
              moves.push({ x: newX, y: newY });
            }
          }
        });
        break;

      case 'knight':
        // L-shaped moves
        [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dx, dy]) => {
          const newX = position.x + dx;
          const newY = position.y + dy;
          if (newX >= 0 && newX < 8 && newY >= 0 && newY < 8) {
            const target = getPieceAt(newX, newY);
            if (!target || target.team !== team) {
              moves.push({ x: newX, y: newY });
            }
          }
        });
        break;
    }

    setPossibleMoves(moves);
  };

  const isSquareHighlighted = (x: number, y: number) => {
    return possibleMoves.some(move => move.x === x && move.y === y);
  };

  const isSquareSelected = (x: number, y: number) => {
    return selectedPiece?.position.x === x && selectedPiece?.position.y === y;
  };

  const getStatusMessage = () => {
    if (gameState.winningTeam) {
      return `Winner: ${gameState.winningTeam === playerTeam ? 'You' : 'Opponent'}!`;
    }
    if (isMyTurn) {
      return 'Your turn';
    }
    return "Opponent's turn";
  };

  const renderSquare = (x: number, y: number) => {
    const isLight = (x + y) % 2 === 0;
    const piece = getPieceAt(x, y);
    const isHighlighted = isSquareHighlighted(x, y);
    const isSelected = isSquareSelected(x, y);

    return (
      <button
        key={`${x}-${y}`}
        onClick={() => handleSquareClick(x, y)}
        disabled={!isMyTurn || gameState.winningTeam !== null}
        className={`
          w-16 h-16 flex items-center justify-center text-3xl
          ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
          ${isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : ''}
          ${isHighlighted ? 'bg-green-400' : ''}
          transition-all duration-150
          ${piece && piece.team === playerTeam && isMyTurn ? 'cursor-pointer hover:opacity-80' : ''}
        `}
      >
        {piece && PIECE_IMAGES[piece.team]?.[piece.type]}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="mb-4 text-center">
        <p className="text-xl font-semibold text-gray-800">{getStatusMessage()}</p>
        <p className="text-sm text-gray-600 mt-1">
          You are: {playerTeam === 'w' ? 'White (Bottom)' : 'Black (Top)'} | Turn: {gameState.totalTurns}
        </p>
      </div>
      <div className="grid grid-cols-8 gap-0 border-4 border-gray-800 rounded-lg overflow-hidden shadow-2xl">
        {Array.from({ length: 64 }).map((_, index) => {
          const x = index % 8;
          const y = Math.floor(index / 8);
          // Render board: y=0 (white pieces) at bottom, y=7 (black pieces) at top
          // So we render rows in reverse order
          const renderY = 7 - y;
          return renderSquare(x, renderY);
        })}
      </div>
    </div>
  );
}

