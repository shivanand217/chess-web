// Paginated history of games the signed-in player has participated in. One row per game: opponent,
// result (W/L/D or active), time control, end reason, link to the replay viewer. "Load more" fetches
// the next cursor.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthError, type GameHistoryEntry } from "@chess/client";
import { chessClient } from "@/lib/chess-client";
import { useSession } from "@/lib/session-store";

function outcomeFor(g: GameHistoryEntry): {
  label: string;
  tone: "win" | "loss" | "draw" | "active";
} {
  if (g.status === "active") return { label: "LIVE", tone: "active" };
  if (g.result === "1/2-1/2") return { label: "D", tone: "draw" };
  const won =
    (g.result === "1-0" && g.myColor === "w") ||
    (g.result === "0-1" && g.myColor === "b");
  return won ? { label: "W", tone: "win" } : { label: "L", tone: "loss" };
}

const TONE_STYLES: Record<ReturnType<typeof outcomeFor>["tone"], string> = {
  win: "border-emerald-700/60 bg-emerald-950/50 text-emerald-200",
  loss: "border-red-700/60 bg-red-950/40 text-red-200",
  draw: "border-neutral-700 bg-neutral-800/70 text-neutral-200",
  active: "border-blue-700/60 bg-blue-950/40 text-blue-200",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GamesPage() {
  const { session } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!session) return;
      setLoading(true);
      setError(undefined);
      try {
        const page = await chessClient().http.getPlayerGames(session.playerId, {
          limit: 20,
          ...(reset ? {} : cursor ? { cursor } : {}),
        });
        setGames((prev) => (reset ? page.games : [...prev, ...page.games]));
        setCursor(page.nextCursor);
      } catch (err) {
        if (err instanceof AuthError) {
          router.replace("/");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load games.");
      } finally {
        setLoading(false);
      }
    },
    [session, cursor, router],
  );

  useEffect(() => {
    if (!session) {
      router.replace("/");
      return;
    }
    void loadPage(true);
    // Only run on first mount + when the session identity changes — pagination triggers its own fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.playerId]);

  if (!session) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold">
            Chess
          </Link>
          <nav className="flex items-center gap-3 text-xs text-neutral-400">
            <Link href="/leaderboard" className="hover:text-neutral-200">
              Leaderboard
            </Link>
            <Link
              href="/"
              className="rounded border border-neutral-800 px-2.5 py-1 hover:bg-neutral-900"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your games</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Click a row to replay it move by move.
        </p>

        {error ? (
          <p className="mt-6 rounded-md border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-800">
          {games.length === 0 && !loading ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              No games yet. Play one from the home page.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Result</th>
                  <th className="px-4 py-2">Opponent</th>
                  <th className="px-4 py-2">You played</th>
                  <th className="px-4 py-2">End</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const o = outcomeFor(g);
                  const href =
                    g.status === "active"
                      ? `/game/${g.gameId}`
                      : `/game/${g.gameId}/replay`;
                  return (
                    <tr
                      key={g.gameId}
                      className="border-t border-neutral-900/80 hover:bg-neutral-900/40"
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block w-10 rounded border px-1.5 py-0.5 text-center text-xs font-semibold ${TONE_STYLES[o.tone]}`}
                        >
                          {o.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-200">
                        {g.opponent.username}{" "}
                        <span className="text-xs text-neutral-500">
                          ({g.opponent.ratingStart})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-300">
                        {g.myColor === "w" ? "White" : "Black"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-400">
                        {g.endReason ??
                          (g.status === "active" ? "in progress" : "—")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-neutral-400">
                        {g.timeControl}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-500">
                        {fmtDate(g.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={href}
                          className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                        >
                          {g.status === "active" ? "Resume" : "Replay"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {cursor ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => loadPage(false)}
              disabled={loading}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
