// A compact row of pieces captured BY the given side. Rendered inside the player strip so you can
// see material status at a glance. Material advantage ("+3") shows next to the side that's ahead.
"use client";

import { useGameStore } from "@/lib/game-store";

const GLYPH: Record<string, { w: string; b: string }> = {
  p: { w: "♙", b: "♟" },
  n: { w: "♘", b: "♞" },
  b: { w: "♗", b: "♝" },
  r: { w: "♖", b: "♜" },
  q: { w: "♕", b: "♛" },
};
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
// Standard order: pawns, knights, bishops, rooks, queens — smallest first.
const ORDER = ["p", "n", "b", "r", "q"] as const;

function sortCaptured(cap: readonly string[]) {
  return [...cap].sort(
    (a, b) => ORDER.indexOf(a as "p") - ORDER.indexOf(b as "p"),
  );
}

function totalValue(cap: readonly string[]) {
  return cap.reduce((n, p) => n + (VALUE[p] ?? 0), 0);
}

export function CapturedTray({ side }: { side: "w" | "b" }) {
  const captured = useGameStore((s) => s.captured);
  // The side DISPLAYED here is losing these pieces; `side === "b"` means we show black's losses,
  // which is what white captured.
  const myLosses = side === "w" ? captured.byBlack : captured.byWhite;
  const oppLosses = side === "w" ? captured.byWhite : captured.byBlack;
  const diff = totalValue(oppLosses) - totalValue(myLosses);

  // Captured pieces to render are the ones that LEFT the board on `side` — i.e. captured by the OTHER
  // colour. Their glyphs should match `side`'s colour.
  const pieces = sortCaptured(myLosses);
  const glyphColor: "w" | "b" = side;

  return (
    <div className="flex min-h-[18px] flex-wrap items-center gap-0.5 text-base leading-none text-neutral-300">
      {pieces.map((p, i) => (
        <span
          key={`${p}-${i}`}
          className="opacity-80"
          aria-label={`captured ${p}`}
        >
          {GLYPH[p]?.[glyphColor] ?? ""}
        </span>
      ))}
      {diff > 0 ? (
        <span className="ml-1 text-xs font-medium text-neutral-400">
          +{diff}
        </span>
      ) : null}
    </div>
  );
}
