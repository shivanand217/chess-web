// Running move log pulled from the game store. SAN pairs in standard "1. e4 e5" format; the latest
// ply is tinted so your eye lands on it. Auto-scrolls to the bottom.
"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/game-store";

export function MoveList() {
  const moves = useGameStore((s) => s.moves);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPly = moves.length - 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  const rows: Array<{ n: number; white?: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: moves[i]?.san,
      ...(moves[i + 1] ? { black: moves[i + 1]?.san } : {}),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-neutral-800 bg-neutral-900/60">
      <div className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Moves
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">No moves yet.</p>
        ) : (
          <table className="w-full text-sm font-mono">
            <tbody>
              {rows.map((r, idx) => {
                const whiteIdx = idx * 2;
                const blackIdx = idx * 2 + 1;
                return (
                  <tr
                    key={r.n}
                    className="border-b border-neutral-900/60 last:border-0 hover:bg-neutral-900/40"
                  >
                    <td className="w-10 py-1.5 pl-3 pr-2 text-right text-neutral-500">
                      {r.n}.
                    </td>
                    <td
                      className={`w-1/2 py-1.5 pr-2 ${
                        whiteIdx === lastPly
                          ? "bg-neutral-800/70 text-neutral-50"
                          : "text-neutral-200"
                      }`}
                    >
                      {r.white}
                    </td>
                    <td
                      className={`py-1.5 pr-3 ${
                        blackIdx === lastPly
                          ? "bg-neutral-800/70 text-neutral-50"
                          : "text-neutral-200"
                      }`}
                    >
                      {r.black ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
