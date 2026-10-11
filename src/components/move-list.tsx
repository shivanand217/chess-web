// Running move log pulled from the game store. SAN pairs in standard "1. e4 e5" format; auto-scrolls
// to the latest move. Click a half-move entry later to board-replay (TODO — not wired yet).
"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/game-store";

export function MoveList() {
  const moves = useGameStore((s) => s.moves);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  // Group plies into full moves. SAN comes server-side; `moves` is already in game order.
  const rows: Array<{ n: number; white?: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: moves[i]?.san,
      ...(moves[i + 1] ? { black: moves[i + 1]?.san } : {}),
    });
  }

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/60">
      <div className="border-b border-neutral-800 px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
        Moves
      </div>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">No moves yet.</p>
        ) : (
          <table className="w-full text-sm font-mono">
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.n}
                  className="border-b border-neutral-900/60 last:border-0"
                >
                  <td className="w-10 py-1.5 pl-3 pr-2 text-right text-neutral-500">
                    {r.n}.
                  </td>
                  <td className="w-1/2 py-1.5 pr-2 text-neutral-200">
                    {r.white}
                  </td>
                  <td className="py-1.5 pr-3 text-neutral-200">
                    {r.black ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
