// Server-authoritative clock with client-side ticking. The server pushes `whiteMs/blackMs` on every
// state-affecting event, stamping `lastSyncAt` with Date.now(); between events we display
// `base - (now - lastSyncAt)` for whichever side is on turn, so the mover's clock looks continuous.
"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/game-store";

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  // Low-time (<10s) shows deci-seconds so the pressure feels real.
  if (total < 10) {
    const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
    return `${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}`;
}

export function Clock({ color }: { color: "w" | "b" }) {
  const base = useGameStore((s) => (color === "w" ? s.whiteMs : s.blackMs));
  const turn = useGameStore((s) => s.turn);
  const phase = useGameStore((s) => s.phase);
  const lastSyncAt = useGameStore((s) => s.lastSyncAt);
  const [, bump] = useState(0);

  const isActive = phase === "playing" && turn === color;

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => bump((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [isActive]);

  const elapsed = isActive ? Date.now() - lastSyncAt : 0;
  const remaining = Math.max(0, base - elapsed);
  const low = isActive && remaining < 10_000;

  return (
    <div
      className={`rounded-md border px-3 py-1.5 font-mono text-xl tabular-nums tracking-tight transition-colors ${
        low
          ? "border-red-500/80 bg-red-950/60 text-red-200"
          : isActive
            ? "border-emerald-500/80 bg-emerald-950/60 text-emerald-100"
            : "border-neutral-800 bg-neutral-900 text-neutral-400"
      }`}
    >
      {fmt(remaining)}
    </div>
  );
}
