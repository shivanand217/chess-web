// Server-authoritative clock with client-side ticking. The server pushes `whiteMs/blackMs` on every
// state-affecting event, stamping `lastSyncAt` with the local Date.now(); between events we display
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

  return (
    <div
      className={`rounded border px-4 py-2 font-mono text-2xl ${
        isActive
          ? "border-emerald-500 bg-emerald-950 text-emerald-200"
          : "border-neutral-700 bg-neutral-900 text-neutral-400"
      }`}
    >
      {fmt(remaining)}
    </div>
  );
}
