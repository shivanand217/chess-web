// Held long-poll driven by the matchmaking store (not a useEffect-level fetch). The store dedupes
// across React Strict Mode's double-mount — the critical fix without which two requests fire per tab
// and the matchmaker pairs each player with their own second request. Navigation triggers cancel only
// on user action, not on remount.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMatchmaking } from "@/lib/matchmaking-store";
import { useSession } from "@/lib/session-store";

const TIME_CONTROL = "blitz-3-2";

export default function MatchmakingPage() {
  const router = useRouter();
  const { session, logout } = useSession();
  const status = useMatchmaking((s) => s.status);
  const pairing = useMatchmaking((s) => s.pairing);
  const errorMsg = useMatchmaking((s) => s.error);
  const start = useMatchmaking((s) => s.start);
  const cancel = useMatchmaking((s) => s.cancel);
  const reset = useMatchmaking((s) => s.reset);
  const [elapsed, setElapsed] = useState(0);

  // Bounce to login if the session is missing.
  useEffect(() => {
    if (!session) router.replace("/");
  }, [session, router]);

  // Kick off the search on mount — the store dedupes so Strict Mode's second mount is a no-op.
  useEffect(() => {
    if (session && (status === "idle" || status === "cancelled")) {
      start(TIME_CONTROL);
    }
  }, [session, status, start]);

  // Hand off to the game page when a pairing lands.
  useEffect(() => {
    if (status === "matched" && pairing) {
      router.replace(`/game/${pairing.gameId}`);
    }
    if (status === "auth_expired") {
      logout();
      router.replace("/");
    }
  }, [status, pairing, router, logout]);

  // Live-ticking seconds counter while the long-poll is open.
  useEffect(() => {
    if (status !== "searching") return;
    const start = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500,
    );
    return () => clearInterval(id);
  }, [status]);

  const onCancel = (): void => {
    cancel();
    router.push("/");
  };

  const onRetry = (): void => {
    reset();
    start(TIME_CONTROL);
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-2xl font-semibold">Matchmaking</h1>
        <p className="text-sm text-neutral-400">
          Time control <span className="font-mono">{TIME_CONTROL}</span>
          {session ? (
            <>
              {" · "}
              <span className="font-mono">{session.username}</span>
            </>
          ) : null}
        </p>
      </header>

      {status === "searching" ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-sm text-neutral-300">
              Looking for an opponent…{" "}
              <span className="font-mono text-neutral-500">{elapsed}s</span>
            </p>
          </div>
          <p className="text-xs text-neutral-500">
            The matchmaker widens the rating window the longer you wait.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="w-fit rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        </section>
      ) : null}

      {status === "matched" ? (
        <p className="text-sm text-emerald-400">Matched. Loading board…</p>
      ) : null}

      {status === "timeout" ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral-300">
            No opponent showed up in time.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Back
            </button>
          </div>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-red-400">
            Something went wrong{errorMsg ? `: ${errorMsg}` : ""}.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            Try again
          </button>
        </section>
      ) : null}
    </main>
  );
}
