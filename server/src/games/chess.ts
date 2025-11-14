export class ChessGame {
  public pieces: Array<{
    type: string;
    team: string;
    position: { x: number; y: number };
    hasMoved: boolean;
  }>;
  public totalTurns: number;
  public currentTeam: string;
  public winningTeam: string | null;

  constructor() {
    this.pieces = this.initializePieces();
    this.totalTurns = 0;
    this.currentTeam = "w";
    this.winningTeam = null;
  }

  private initializePieces() {
    const pieces: Array<{
      type: string;
      team: string;
      position: { x: number; y: number };
      hasMoved: boolean;
    }> = [];

    // Black pieces (top)
    const blackPieces = [
      { type: "rook", pos: [0, 7] },
      { type: "knight", pos: [1, 7] },
      { type: "bishop", pos: [2, 7] },
      { type: "queen", pos: [3, 7] },
      { type: "king", pos: [4, 7] },
      { type: "bishop", pos: [5, 7] },
      { type: "knight", pos: [6, 7] },
      { type: "rook", pos: [7, 7] },
    ];

    blackPieces.forEach((p) => {
      pieces.push({
        type: p.type,
        team: "b",
        position: { x: p.pos[0], y: p.pos[1] },
        hasMoved: false,
      });
    });

    // Black pawns
    for (let x = 0; x < 8; x++) {
      pieces.push({
        type: "pawn",
        team: "b",
        position: { x, y: 6 },
        hasMoved: false,
      });
    }

    // White pieces (bottom)
    const whitePieces = [
      { type: "rook", pos: [0, 0] },
      { type: "knight", pos: [1, 0] },
      { type: "bishop", pos: [2, 0] },
      { type: "queen", pos: [3, 0] },
      { type: "king", pos: [4, 0] },
      { type: "bishop", pos: [5, 0] },
      { type: "knight", pos: [6, 0] },
      { type: "rook", pos: [7, 0] },
    ];

    whitePieces.forEach((p) => {
      pieces.push({
        type: p.type,
        team: "w",
        position: { x: p.pos[0], y: p.pos[1] },
        hasMoved: false,
      });
    });

    // White pawns
    for (let x = 0; x < 8; x++) {
      pieces.push({
        type: "pawn",
        team: "w",
        position: { x, y: 1 },
        hasMoved: false,
      });
    }

    return pieces;
  }

  makeMove(
    from: { x: number; y: number },
    to: { x: number; y: number },
    team: string,
  ): boolean {
    if (this.winningTeam !== null) {
      return false;
    }

    if (this.currentTeam !== team) {
      return false;
    }

    const piece = this.pieces.find(
      (p) => p.position.x === from.x && p.position.y === from.y,
    );

    if (!piece || piece.team !== team) {
      return false;
    }

    // Simple move validation (can be enhanced with full chess rules)
    piece.position = { x: to.x, y: to.y };
    piece.hasMoved = true;

    // Remove captured piece
    const capturedIndex = this.pieces.findIndex(
      (p) => p.position.x === to.x && p.position.y === to.y && p.team !== team,
    );
    if (capturedIndex !== -1) {
      this.pieces.splice(capturedIndex, 1);
    }

    this.totalTurns++;
    this.currentTeam = this.currentTeam === "w" ? "b" : "w";

    // Check for checkmate (simplified - check if king is captured)
    const king = this.pieces.find(
      (p) => p.type === "king" && p.team !== team,
    );
    if (!king) {
      this.winningTeam = team;
    }

    return true;
  }

  getState() {
    return {
      pieces: this.pieces,
      totalTurns: this.totalTurns,
      currentTeam: this.currentTeam,
      winningTeam: this.winningTeam,
    };
  }

  reset(): void {
    this.pieces = this.initializePieces();
    this.totalTurns = 0;
    this.currentTeam = "w";
    this.winningTeam = null;
  }
}

