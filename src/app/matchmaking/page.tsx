// Held long-poll against the gateway. Cancel aborts the request and sends the matchmaker a DELETE so the
// pool slot clears. The time control is hard-coded to blitz-3-2 for now — a selector lands with the
// opponent-filtering UX.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchmakingTimeoutError, AuthError } from '@chess/client';
import { chessClient } from '@/lib/chess-client';
import { useSession } from '@/lib/session-store';
import { usePairing } from '@/lib/pairing-store';

type Status = 'searching' | 'matched' | 'timeout' | 'error' | 'cancelled';

const TIME_CONTROL = 'blitz-3-2';

export default function MatchmakingPage() {
  const router = useRouter();
  const { session, logout } = useSession();
  const setPairing = usePairing((s) => s.set);
  const [status, setStatus] = useState<Status>('searching');
  const [message, setMessage] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController>(null);

  // Guard: bounce to login if the session is missing.
  useEffect(() => {
    if (!session) router.replace('/');
  }, [session, router]);

  // Fire the long-poll on mount; abort if the user leaves the page.
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    abortRef.current = controller;
    (async () => {
      try {
        const match = await chessClient().http.findMatch(TIME_CONTROL, controller.signal);
        setPairing(match);
        setStatus('matched');
        router.replace(`/game/${match.gameId}`);
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus('cancelled');
          return;
        }
        if (err instanceof MatchmakingTimeoutError) {
          setStatus('timeout');
          return;
        }
        if (err instanceof AuthError) {
          logout();
          router.replace('/');
          return;
        }
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'unknown error');
      }
    })();
    return () => controller.abort();
  }, [session, router, setPairing, logout]);

  // Simple seconds counter so the UI feels alive while we wait.
  useEffect(() => {
    if (status !== 'searching') return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1_000);
    return () => clearInterval(t);
  }, [status]);

  const retry = (): void => {
    setStatus('searching');
    setElapsed(0);
    setMessage(undefined);
    router.refresh();
  };

  const cancel = (): void => {
    abortRef.current?.abort();
    router.push('/');
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-2xl font-semibold">Matchmaking</h1>
        <p className="text-sm text-neutral-400">
          Time control <span className="font-mono">{TIME_CONTROL}</span>
          {session ? (
            <>
              {' · '}
              <span className="font-mono">{session.username}</span>
            </>
          ) : null}
        </p>
      </header>

      {status === 'searching' ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
            <p className="text-sm text-neutral-300">
              Looking for an opponent… <span className="font-mono text-neutral-500">{elapsed}s</span>
            </p>
          </div>
          <p className="text-xs text-neutral-500">
            The matchmaker widens the rating window the longer you wait, so a lonely extreme-rating
            player still gets paired.
          </p>
          <button
            type="button"
            onClick={cancel}
            className="w-fit rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        </section>
      ) : null}

      {status === 'matched' ? (
        <p className="text-sm text-emerald-400">Matched. Loading board…</p>
      ) : null}

      {status === 'timeout' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral-300">No opponent showed up in time.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retry}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Back
            </button>
          </div>
        </section>
      ) : null}

      {status === 'error' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-red-400">
            Something went wrong{message ? `: ${message}` : ''}.
          </p>
          <button
            type="button"
            onClick={retry}
            className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            Try again
          </button>
        </section>
      ) : null}
    </main>
  );
}
