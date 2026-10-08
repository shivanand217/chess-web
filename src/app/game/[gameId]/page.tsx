// Game view: opens a WS session via @chess/client's GameSession, mirrors the state into the Zustand
// game store, and renders the board + clocks + a thin header. Direct-link / reload rehydrates the
// pairing from GET /games/:id.
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, NotFoundError } from "@chess/client";
import { Board } from "@/components/board";
import { Clock } from "@/components/clock";
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
  const result = useGameStore((s) => s.result);
  const endReason = useGameStore((s) => s.endReason);
  const rejected = useGameStore((s) => s.lastRejectedReason);
  const error = useGameStore((s) => s.error);

  const [bootstrap, setBootstrap] = useState<Bootstrap | undefined>();
  const [bootstrapError, setBootstrapError] = useState<string>();

  useEffect(() => {
    if (!session) {
      router.replace("/");
      return;
    }

    (async () => {
      // Fast path: the matchmaking page just handed us the whole response.
      if (pairing && pairing.gameId === gameId && pairing.wsUrl) {
        setBootstrap({
          wsUrl: pairing.wsUrl,
          myColor: pairing.color,
          opponent: pairing.opponent.username,
        });
        return;
      }
      // Reload / direct-link path: rehydrate from the gateway.
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

  // Open the WS once we know where to go.
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
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-fit rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Back
        </button>
      </main>
    );
  }

  const topColor: "w" | "b" = myColor === "b" ? "w" : "b";
  const bottomColor: "w" | "b" = myColor ?? "w";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Game</h1>
          <p className="text-xs text-neutral-500 font-mono">{gameId}</p>
        </div>
        <div className="flex gap-2">
          {phase === "playing" ? (
            <button
              type="button"
              onClick={() => resign()}
              className="rounded border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/40"
            >
              Resign
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Back
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          {bootstrap ? (
            <>
              Playing{" "}
              <span className="font-mono">
                {myColor === "w" ? "White" : "Black"}
              </span>{" "}
              vs <span className="font-mono">{bootstrap.opponent}</span>
            </>
          ) : (
            "Connecting…"
          )}
        </p>
        {rejected ? <p className="text-xs text-amber-400">{rejected}</p> : null}
      </div>

      <Clock color={topColor} />
      <Board />
      <Clock color={bottomColor} />

      {phase === "ended" && result ? (
        <div className="rounded border border-neutral-800 bg-neutral-900 p-4 text-sm">
          <p>
            Game ended — <span className="font-mono">{result}</span> by{" "}
            <span className="font-mono">{endReason}</span>.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </main>
  );
}
