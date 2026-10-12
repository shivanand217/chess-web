// Wrapper over react-chessboard that layers in the live-game interactions:
//  - themed squares (chess.com-style green/cream)
//  - last-move highlight (yellow tint on from+to)
//  - click-to-move: click a piece to select, click a destination to commit; drag still works too
//  - legal-move dots (small circle on empty targets, outer ring on captures)
//  - check radial on the checked king's square
//  - promotion dialog on pawn-to-back-rank drops/clicks
"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useGameStore } from "@/lib/game-store";
import { PromotionDialog, type PromotionPiece } from "./promotion-dialog";

interface PendingPromotion {
  from: string;
  to: string;
  color: "w" | "b";
}

function isPromotion(fen: string, from: string, to: string): boolean {
  const probe = new Chess(fen);
  const piece = probe.get(from as Square);
  if (!piece || piece.type !== "p") return false;
  const rank = to[1];
  return (
    (piece.color === "w" && rank === "8") ||
    (piece.color === "b" && rank === "1")
  );
}

const LAST_MOVE_STYLE = { background: "rgba(255, 236, 100, 0.42)" };
const SELECTED_STYLE = { background: "rgba(255, 236, 100, 0.55)" };
const CHECK_STYLE = {
  background:
    "radial-gradient(circle, rgba(255, 90, 90, 0.95) 0%, rgba(255, 90, 90, 0.65) 40%, rgba(255, 90, 90, 0) 70%)",
};
const LEGAL_DOT_STYLE = {
  background:
    "radial-gradient(circle, rgba(0, 0, 0, 0.28) 22%, transparent 24%)",
};
const LEGAL_CAPTURE_STYLE = {
  background:
    "radial-gradient(circle, transparent 55%, rgba(0, 0, 0, 0.32) 56%, rgba(0, 0, 0, 0.32) 62%, transparent 63%)",
};

export function Board() {
  const fen = useGameStore((s) => s.fen);
  const myColor = useGameStore((s) => s.myColor);
  const phase = useGameStore((s) => s.phase);
  const tryDrop = useGameStore((s) => s.tryDrop);
  const selectSquare = useGameStore((s) => s.selectSquare);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const selected = useGameStore((s) => s.selectedSquare);
  const legalTargets = useGameStore((s) => s.legalTargets);
  const lastMove = useGameStore((s) => s.lastMove);
  const checkedSquare = useGameStore((s) => s.checkedSquare);
  const [pending, setPending] = useState<PendingPromotion>();

  const canPlay = phase === "playing";

  const squareStyles = useMemo(() => {
    const out: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      out[lastMove.from] = { ...out[lastMove.from], ...LAST_MOVE_STYLE };
      out[lastMove.to] = { ...out[lastMove.to], ...LAST_MOVE_STYLE };
    }
    if (checkedSquare) {
      out[checkedSquare] = { ...out[checkedSquare], ...CHECK_STYLE };
    }
    if (selected) {
      out[selected] = { ...out[selected], ...SELECTED_STYLE };
    }
    // The legal-target overlays go last so they win against the from/to tint for the exact
    // square-under-the-dot (visually clearer).
    const probe = new Chess(fen);
    for (const sq of legalTargets) {
      const occupant = probe.get(sq as Square);
      out[sq] = {
        ...out[sq],
        ...(occupant ? LEGAL_CAPTURE_STYLE : LEGAL_DOT_STYLE),
      };
    }
    return out;
  }, [fen, lastMove, selected, legalTargets, checkedSquare]);

  const onDrop = (
    sourceSquare: string,
    targetSquare: string | null,
  ): boolean => {
    if (!targetSquare || sourceSquare === targetSquare) return false;
    if (isPromotion(fen, sourceSquare, targetSquare) && myColor) {
      setPending({ from: sourceSquare, to: targetSquare, color: myColor });
      return false;
    }
    return tryDrop(sourceSquare, targetSquare);
  };

  const onSquareClick = (square: string) => {
    if (!canPlay) return;

    // Clicking a legal target when a piece is selected: commit (with promotion check).
    if (selected && legalTargets.includes(square)) {
      if (isPromotion(fen, selected, square) && myColor) {
        setPending({ from: selected, to: square, color: myColor });
        clearSelection();
        return;
      }
      tryDrop(selected, square);
      return;
    }

    // Otherwise defer to the store's selection logic (will select / reselect / clear as needed).
    selectSquare(square);
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
          animationDurationInMs: 160,
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          darkSquareStyle: { backgroundColor: "#769656" },
          squareStyles,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            onDrop(sourceSquare, targetSquare),
          onSquareClick: ({ square }) => onSquareClick(square),
          onPieceClick: ({ square }) => {
            if (square) onSquareClick(square);
          },
          boardStyle: {
            borderRadius: 6,
            boxShadow: "0 14px 40px -18px rgba(0, 0, 0, 0.6)",
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
