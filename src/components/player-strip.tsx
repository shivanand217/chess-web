// One row above/below the board. Shows the player's name + captured-pieces strip on the left,
// clock on the right. Highlighted when it's that side's turn.
"use client";

import { useGameStore } from "@/lib/game-store";
import { CapturedTray } from "./captured-tray";
import { Clock } from "./clock";

export function PlayerStrip({
  side,
  name,
  rating,
  isMe,
}: {
  side: "w" | "b";
  name: string;
  rating?: number;
  isMe?: boolean;
}) {
  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const active = phase === "playing" && turn === side;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${
        active
          ? "border-emerald-700/70 bg-emerald-950/40"
          : "border-neutral-800 bg-neutral-900/60"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border text-xs font-semibold ${
            side === "w"
              ? "border-neutral-500 bg-neutral-100 text-neutral-900"
              : "border-neutral-700 bg-neutral-800 text-neutral-100"
          }`}
          aria-label={`${side === "w" ? "White" : "Black"} pieces`}
        >
          {side === "w" ? "W" : "B"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-neutral-100">
              {name}
            </span>
            {rating !== undefined ? (
              <span className="text-xs text-neutral-500">({rating})</span>
            ) : null}
            {isMe ? (
              <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
                You
              </span>
            ) : null}
          </div>
          <CapturedTray side={side} />
        </div>
      </div>
      <Clock color={side} />
    </div>
  );
}
