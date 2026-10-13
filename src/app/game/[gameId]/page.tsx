// Game view: opens a WS session via @chess/client's GameSession, mirrors state into the Zustand
// game store, renders the chess.com-style two-column layout — board left (with player strips above
// and below), moves + controls panel on the right. Reload / direct-link rehydrates from GET /games/:id.
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthError, NotFoundError } from "@chess/client";
import { Board } from "@/components/board";
import { DrawControls } from "@/components/draw-controls";
import { CheckBanner, GameEndBanner } from "@/components/game-banner";
import { MoveList } from "@/components/move-list";
import { PlayerStrip } from "@/components/player-strip";
import { SoundToggle } from "@/components/sound-toggle";
import { chessClient } from "@/lib/chess-client";
import { useGameStore } from "@/lib/game-store";
import { useMatchmaking } from "@/lib/matchmaking-store";
import { useSession } from "@/lib/session-store";

type Params = { gameId: string };

interface Bootstrap {
  wsUrl: string;
  myColor: "w" | "b";
  opponent: string;
}

export default function GamePage({ params }: { params: Promise<Params> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const { session, logout } = useSession();
  const pairing = useMatchmaking((s) => s.pairing);
  const resetMatchmaking = useMatchmaking((s) => s.reset);
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const resign = useGameStore((s) => s.resign);
  const phase = useGameStore((s) => s.phase);
  const myColor = useGameStore((s) => s.myColor);
  const rejected = useGameStore((s) => s.lastRejectedReason);
  const error = useGameStore((s) => s.error);

  const [bootstrap, setBootstrap] = useState<Bootstrap | undefined>();
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [confirmResign, setConfirmResign] = useState(false);

  useEffect(() => {
    if (!session) {
      router.replace("/");
      return;
    }

    (async () => {
      if (pairing && pairing.gameId === gameId && pairing.wsUrl) {
        setBootstrap({
          wsUrl: pairing.wsUrl,
          myColor: pairing.color,
          opponent: pairing.opponent.username,
        });
        return;
      }
      try {
        const game = await chessClient().http.getGame(gameId);
        if (!game.wsUrl) {
          setBootstrapError("No game-server advertised for this game.");
          return;
        }
        setBootstrap({
          wsUrl: game.wsUrl,
          myColor: game.whiteId === session.playerId ? "w" : "b",
          opponent: "opponent",
        });
      } catch (err) {
        if (err instanceof NotFoundError) {
          setBootstrapError("Game not found.");
          return;
        }
        if (err instanceof AuthError) {
          logout();
          router.replace("/");
          return;
        }
        setBootstrapError(
          err instanceof Error ? err.message : "Failed to load game.",
        );
      }
    })();

    return () => resetMatchmaking();
  }, [session, router, pairing, gameId, resetMatchmaking, logout]);

  useEffect(() => {
    if (!bootstrap || !session) return;
    connect({
      wsUrl: bootstrap.wsUrl,
      gameId,
      playerId: session.playerId,
      token: session.token,
    });
    return () => disconnect();
  }, [bootstrap, session, gameId, connect, disconnect]);

  if (bootstrapError) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-10">
        <h1 className="text-2xl font-semibold">Game</h1>
        <p className="text-sm text-red-400">{bootstrapError}</p>
        <Link
          href="/"
          className="w-fit rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Back
        </Link>
      </main>
    );
  }

  const topColor: "w" | "b" = myColor === "b" ? "w" : "b";
  const bottomColor: "w" | "b" = myColor ?? "w";
  const myName = session?.username ?? "You";
  const oppName = bootstrap?.opponent ?? "opponent";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="text-sm font-semibold text-neutral-100 hover:text-white"
          >
            Chess
          </Link>
          <nav className="flex items-center gap-3 text-xs text-neutral-400">
            <Link href="/leaderboard" className="hover:text-neutral-200">
              Leaderboard
            </Link>
            <SoundToggle />
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
        {/* Board column */}
        <section className="flex min-w-0 flex-col gap-3">
          <PlayerStrip side={topColor} name={oppName} />
          <div className="relative">
            <CheckBanner />
            <div className="mt-2">
              <Board />
            </div>
          </div>
          <PlayerStrip side={bottomColor} name={myName} isMe />
          {rejected ? (
            <p className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-300">
              {rejected}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-sm text-red-300">
              {error}
            </p>
          ) : null}
        </section>

        {/* Side panel */}
        <aside className="flex min-h-[520px] flex-col gap-3">
          <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Game
            </div>
            <div className="mt-1 font-mono text-xs text-neutral-400 break-all">
              {gameId}
            </div>
            <div className="mt-2 text-sm text-neutral-300">
              You are playing{" "}
              <span className="font-medium text-neutral-100">
                {myColor === "w" ? "White" : myColor === "b" ? "Black" : "…"}
              </span>{" "}
              vs <span className="font-medium text-neutral-100">{oppName}</span>
            </div>
          </div>

          <MoveList />

          <GameEndBanner />

          {phase === "playing" ? <DrawControls /> : null}

          {phase === "playing" ? (
            <div className="flex gap-2">
              {confirmResign ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resign();
                      setConfirmResign(false);
                    }}
                    className="flex-1 rounded-md border border-red-600 bg-red-900/60 px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-800"
                  >
                    Confirm resign
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                    className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResign(true)}
                  className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  Resign
                </button>
              )}
            </div>
          ) : phase === "ended" ? (
            <div className="flex gap-2">
              <Link
                href="/matchmaking"
                className="flex-1 rounded-md border border-emerald-700/60 bg-emerald-900/40 px-3 py-2 text-center text-sm font-medium text-emerald-100 hover:bg-emerald-900/60"
              >
                New game
              </Link>
              <Link
                href="/"
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                Home
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
