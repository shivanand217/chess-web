// Public top-N read from the gateway proxy. No auth required; a logged-in player sees their own
// highlighted row. Pagination is simple prev/next over the 50-row page.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardPage } from "@chess/client";
import { chessClient } from "@/lib/chess-client";
import { useSession } from "@/lib/session-store";

const PAGE_SIZE = 50;

export default function LeaderboardPage() {
  const router = useRouter();
  const { session } = useSession();
  const [page, setPage] = useState<LeaderboardPage>();
  const [error, setError] = useState<string>();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await chessClient().http.getLeaderboard(PAGE_SIZE, offset);
        if (!cancelled) setPage(p);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offset]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-neutral-400">
            Top {PAGE_SIZE} by rating · showing{" "}
            <span className="font-mono">
              {offset + 1}–{offset + (page?.entries.length ?? 0)}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Back
        </button>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-3">Rank</th>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3 text-right">Rating</th>
          </tr>
        </thead>
        <tbody>
          {page?.entries.map((e) => {
            const me = session?.playerId === e.playerId;
            return (
              <tr
                key={e.playerId}
                className={`border-b border-neutral-900 ${
                  me ? "bg-emerald-950/40" : "hover:bg-neutral-900/60"
                }`}
              >
                <td className="py-2 pr-3 font-mono text-neutral-400">
                  #{e.rank}
                </td>
                <td className="py-2 pr-3 font-mono">
                  {e.username}
                  {me ? (
                    <span className="ml-2 text-xs text-emerald-400">(you)</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right font-mono">{e.rating}</td>
              </tr>
            );
          })}
          {page && page.entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-neutral-500">
                No players yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={!page || page.entries.length < PAGE_SIZE}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </main>
  );
}
