// Replay viewer. Fetches the full move log from the gateway and lets you step through SAN with
// ← / → (plus Home / End) or the on-screen buttons. Auto-play toggles a timer that advances every
// 700ms. Reuses the same themed Chessboard with lastMove + check highlights for parity.
"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  NotFoundError,
  type GameSnapshot,
  type MoveRecord,
} from "@chess/client";
import { chessClient } from "@/lib/chess-client";

type Params = { gameId: string };

const AUTO_INTERVAL_MS = 700;

interface Position {
  fen: string;
  turn: "w" | "b";
  lastMove?: { from: string; to: string };
  inCheck: boolean;
  checkedSquare?: string;
}

function kingSquare(c: Chess, color: "w" | "b"): string | undefined {
  const board = c.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.type === "k" && sq.color === color) {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return undefined;
}

/** Replay `moves[0..ply]` through chess.js and return the resulting position + highlights. */
function positionAt(moves: MoveRecord[], ply: number): Position {
  const c = new Chess();
  for (let i = 0; i < ply; i++) {
    try {
      c.move(moves[i].san);
    } catch {
      // Shouldn't happen — the server validated these. If it does, bail out of the loop so we show
      // the last good position.
      break;
    }
  }
  const inCheck = c.inCheck();
  const last = ply > 0 ? moves[ply - 1] : undefined;
  return {
    fen: c.fen(),
    turn: c.turn(),
    inCheck,
    ...(last
      ? { lastMove: { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } }
      : {}),
    ...(inCheck ? { checkedSquare: kingSquare(c, c.turn()) } : {}),
  };
}

export default function ReplayPage({ params }: { params: Promise<Params> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<GameSnapshot | undefined>();
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [ply, setPly] = useState(0);
  const [error, setError] = useState<string>();
  const [autoPlay, setAutoPlay] = useState(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, m] = await Promise.all([
          chessClient().http.getGame(gameId),
          chessClient().http.getGameMoves(gameId),
        ]);
        if (cancelled) return;
        setGame(g);
        setMoves(m);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof NotFoundError) setError("Game not found.");
        else
          setError(err instanceof Error ? err.message : "Failed to load game.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const total = moves.length;
  const atStart = ply <= 0;
  const atEnd = ply >= total;

  const first = useCallback(() => setPly(0), []);
  const prev = useCallback(() => setPly((p) => Math.max(0, p - 1)), []);
  const next = useCallback(
    () => setPly((p) => Math.min(total, p + 1)),
    [total],
  );
  const last = useCallback(() => setPly(total), [total]);

  // Keyboard: arrow keys + Home/End. Ignore when a form field is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "Home") {
        e.preventDefault();
        first();
      } else if (e.key === "End") {
        e.preventDefault();
        last();
      } else if (e.key === " ") {
        e.preventDefault();
        setAutoPlay((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, prev, next, last]);

  // Auto-play: steps forward every AUTO_INTERVAL_MS until we hit the end.
  useEffect(() => {
    if (!autoPlay) return;
    if (atEnd) {
      setAutoPlay(false);
      return;
    }
    const id = setInterval(
      () => setPly((p) => (p < total ? p + 1 : p)),
      AUTO_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [autoPlay, atEnd, total]);

  const position = useMemo(() => positionAt(moves, ply), [moves, ply]);

  const rows = useMemo(() => {
    const out: Array<{ n: number; white?: MoveRecord; black?: MoveRecord }> =
      [];
    for (let i = 0; i < moves.length; i += 2) {
      out.push({
        n: i / 2 + 1,
        white: moves[i],
        ...(moves[i + 1] ? { black: moves[i + 1] } : {}),
      });
    }
    return out;
  }, [moves]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (position.lastMove) {
      styles[position.lastMove.from] = {
        background: "rgba(255, 236, 100, 0.42)",
      };
      styles[position.lastMove.to] = {
        background: "rgba(255, 236, 100, 0.42)",
      };
    }
    if (position.checkedSquare) {
      styles[position.checkedSquare] = {
        background:
          "radial-gradient(circle, rgba(255, 90, 90, 0.95) 0%, rgba(255, 90, 90, 0.65) 40%, rgba(255, 90, 90, 0) 70%)",
      };
    }
    return styles;
  }, [position]);

  if (error) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-10 text-neutral-100">
        <h1 className="text-2xl font-semibold">Replay</h1>
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/games")}
          className="w-fit rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
        >
          Back to games
        </button>
      </main>
    );
  }

  const resultSummary = game
    ? game.result === "1-0"
      ? "White won"
      : game.result === "0-1"
        ? "Black won"
        : game.result === "1/2-1/2"
          ? "Draw"
          : "In progress"
    : "";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold">
            Chess
          </Link>
          <nav className="flex items-center gap-3 text-xs text-neutral-400">
            <Link href="/games" className="hover:text-neutral-200">
              Your games
            </Link>
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

      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-4">
          <Chessboard
            options={{
              position: position.fen,
              allowDragging: false,
              animationDurationInMs: 160,
              lightSquareStyle: { backgroundColor: "#eeeed2" },
              darkSquareStyle: { backgroundColor: "#769656" },
              squareStyles,
              boardStyle: {
                borderRadius: 6,
                boxShadow: "0 14px 40px -18px rgba(0, 0, 0, 0.6)",
              },
            }}
          />

          <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={first}
                disabled={atStart}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={prev}
                disabled={atStart}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={atEnd}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                {autoPlay ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={atEnd}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={last}
                disabled={atEnd}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                ⏭
              </button>
            </div>
            <div className="font-mono text-xs text-neutral-400">
              {ply} / {total}
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            ← / → to step, Home / End to jump, Space to toggle auto-play.
          </p>
        </section>

        <aside className="flex min-h-[520px] flex-col gap-3">
          {game ? (
            <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Game
              </div>
              <div className="mt-1 font-mono text-xs text-neutral-400 break-all">
                {game.gameId}
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                {resultSummary}
                {game.endReason ? (
                  <span className="ml-2 text-xs text-neutral-500">
                    ({game.endReason})
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-neutral-500 font-mono">
                {game.timeControl}
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col rounded-md border border-neutral-800 bg-neutral-900/60">
            <div className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Moves
            </div>
            <div ref={moveListRef} className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-neutral-500">
                  No moves recorded.
                </p>
              ) : (
                <table className="w-full text-sm font-mono">
                  <tbody>
                    {rows.map((r, idx) => {
                      const whiteIdx = idx * 2;
                      const blackIdx = idx * 2 + 1;
                      return (
                        <tr
                          key={r.n}
                          className="border-b border-neutral-900/60 last:border-0"
                        >
                          <td className="w-10 py-1.5 pl-3 pr-2 text-right text-neutral-500">
                            {r.n}.
                          </td>
                          <td
                            className={`w-1/2 cursor-pointer py-1.5 pr-2 ${whiteIdx + 1 === ply ? "bg-neutral-800/70 text-neutral-50" : "text-neutral-200 hover:bg-neutral-800/40"}`}
                            onClick={() => setPly(whiteIdx + 1)}
                          >
                            {r.white?.san}
                          </td>
                          <td
                            className={`cursor-pointer py-1.5 pr-3 ${blackIdx + 1 === ply ? "bg-neutral-800/70 text-neutral-50" : "text-neutral-200 hover:bg-neutral-800/40"}`}
                            onClick={() =>
                              r.black ? setPly(blackIdx + 1) : undefined
                            }
                          >
                            {r.black?.san ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
