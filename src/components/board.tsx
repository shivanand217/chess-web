// Thin wrapper over react-chessboard. On a pawn-to-back-rank drop we hold the move and open the
// PromotionDialog; the user's pick decides the promotion piece. Everything else dispatches to the
// game store's tryDrop directly.
"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useGameStore } from "@/lib/game-store";
import { PromotionDialog, type PromotionPiece } from "./promotion-dialog";

interface PendingPromotion {
  from: string;
  to: string;
  color: "w" | "b";
}

/** True if moving `piece` from `from` to `to` on this position is a pawn reaching the back rank. */
function isPromotion(fen: string, from: string, to: string): boolean {
  const probe = new Chess(fen);
  const piece = probe.get(from as never);
  if (!piece || piece.type !== "p") return false;
  const rank = to[1];
  return (
    (piece.color === "w" && rank === "8") ||
    (piece.color === "b" && rank === "1")
  );
}

export function Board() {
  const fen = useGameStore((s) => s.fen);
  const myColor = useGameStore((s) => s.myColor);
  const phase = useGameStore((s) => s.phase);
  const tryDrop = useGameStore((s) => s.tryDrop);
  const [pending, setPending] = useState<PendingPromotion>();

  const canPlay = phase === "playing";

  const onDrop = (
    sourceSquare: string,
    targetSquare: string | null,
  ): boolean => {
    if (!targetSquare || sourceSquare === targetSquare) return false;
    if (isPromotion(fen, sourceSquare, targetSquare) && myColor) {
      // Suspend the move — the dialog's `onPick` will dispatch the real tryDrop. We return `false`
      // here so react-chessboard snaps the piece back; it animates to the new square once the
      // server's accepted ack flows through the store and the fen changes.
      setPending({ from: sourceSquare, to: targetSquare, color: myColor });
      return false;
    }
    return tryDrop(sourceSquare, targetSquare);
  };

  const resolve = (promotion: PromotionPiece): void => {
    if (!pending) return;
    tryDrop(pending.from, pending.to, promotion);
    setPending(undefined);
  };

  return (
    <>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: myColor === "b" ? "black" : "white",
          allowDragging: canPlay,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            onDrop(sourceSquare, targetSquare),
          boardStyle: {
            borderRadius: 8,
            boxShadow: "0 10px 30px -15px rgba(0, 0, 0, 0.4)",
          },
        }}
      />
      {pending ? (
        <PromotionDialog
          color={pending.color}
          onPick={resolve}
          onCancel={() => setPending(undefined)}
        />
      ) : null}
    </>
  );
}
