// Two banners that layer on top of the board area:
//   1. Check — pulsing amber chip while the side-to-move is in check.
//   2. Game end — large card with "You won / You lost / Draw" + the end reason.
"use client";

import { useGameStore } from "@/lib/game-store";

const REASON_LABEL: Record<string, string> = {
  checkmate: "by checkmate",
  stalemate: "by stalemate",
  draw: "by draw",
  flag: "on time",
  resign: "by resignation",
};

function endSummary(
  myColor: "w" | "b" | undefined,
  result: "1-0" | "0-1" | "1/2-1/2" | undefined,
): { headline: string; tone: "win" | "loss" | "draw" } {
  if (!result || !myColor) return { headline: "Game ended", tone: "draw" };
  if (result === "1/2-1/2") return { headline: "Draw", tone: "draw" };
  const won =
    (result === "1-0" && myColor === "w") ||
    (result === "0-1" && myColor === "b");
  return won
    ? { headline: "You won", tone: "win" }
    : { headline: "You lost", tone: "loss" };
}

export function CheckBanner() {
  const phase = useGameStore((s) => s.phase);
  const inCheck = useGameStore((s) => s.inCheck);
  const turn = useGameStore((s) => s.turn);
  const myColor = useGameStore((s) => s.myColor);
  if (phase !== "playing" || !inCheck) return null;
  const mine = turn === myColor;
  return (
    <div
      className={`flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-medium ${
        mine
          ? "border-amber-500/60 bg-amber-900/30 text-amber-200"
          : "border-amber-700/40 bg-amber-950/30 text-amber-300/80"
      }`}
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
      {mine ? "You are in check" : "Opponent is in check"}
    </div>
  );
}

export function GameEndBanner() {
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const endReason = useGameStore((s) => s.endReason);
  const myColor = useGameStore((s) => s.myColor);
  if (phase !== "ended") return null;

  const { headline, tone } = endSummary(myColor, result);
  const reasonText = endReason ? (REASON_LABEL[endReason] ?? endReason) : "";

  const toneClass =
    tone === "win"
      ? "border-emerald-600/60 bg-emerald-950/50 text-emerald-200"
      : tone === "loss"
        ? "border-red-700/60 bg-red-950/50 text-red-200"
        : "border-neutral-700 bg-neutral-900 text-neutral-200";

  return (
    <div className={`rounded border p-4 text-sm ${toneClass}`}>
      <p className="text-base font-semibold">{headline}</p>
      <p className="mt-1 text-xs opacity-80">
        {result ? (
          <>
            <span className="font-mono">{result}</span> {reasonText}
          </>
        ) : null}
      </p>
    </div>
  );
}
