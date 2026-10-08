// Thin wrapper over react-chessboard. Pulls fen + myColor + drop handler from the game store; nothing
// about the chess rules lives here — the store owns local validation + the WS send.
"use client";

import { Chessboard } from "react-chessboard";
import { useGameStore } from "@/lib/game-store";

export function Board() {
  const fen = useGameStore((s) => s.fen);
  const myColor = useGameStore((s) => s.myColor);
  const phase = useGameStore((s) => s.phase);
  const tryDrop = useGameStore((s) => s.tryDrop);

  const canPlay = phase === "playing";

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: myColor === "b" ? "black" : "white",
        allowDragging: canPlay,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare || sourceSquare === targetSquare) return false;
          // Auto-promote to queen for now; a dialog lands with the full UX pass.
          return tryDrop(sourceSquare, targetSquare, "q");
        },
        boardStyle: {
          borderRadius: 8,
          boxShadow: "0 10px 30px -15px rgba(0, 0, 0, 0.4)",
        },
      }}
    />
  );
}
