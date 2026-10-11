// Modal picker that opens when a pawn drop reaches the back rank. Four piece glyphs; Esc / backdrop
// click cancels. The Board component suspends the drop until the user picks.
"use client";

import { useEffect } from "react";

export type PromotionPiece = "q" | "r" | "b" | "n";

const OPTIONS: Array<{ piece: PromotionPiece; label: string; glyph: string }> =
  [
    { piece: "q", label: "Queen", glyph: "♛" },
    { piece: "r", label: "Rook", glyph: "♜" },
    { piece: "b", label: "Bishop", glyph: "♝" },
    { piece: "n", label: "Knight", glyph: "♞" },
  ];

export function PromotionDialog({
  color,
  onPick,
  onCancel,
}: {
  color: "w" | "b";
  onPick: (p: PromotionPiece) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          Promote to…
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.piece}
              type="button"
              onClick={() => onPick(o.piece)}
              className="flex flex-col items-center gap-1 rounded border border-neutral-700 bg-neutral-800 py-3 hover:border-emerald-500 hover:bg-neutral-700"
              title={o.label}
            >
              <span
                className={`text-3xl ${color === "w" ? "text-neutral-100" : "text-neutral-400"}`}
              >
                {o.glyph}
              </span>
              <span className="text-xs text-neutral-500">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
