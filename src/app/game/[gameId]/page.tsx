// Game page stub. The next chunk wires `react-chessboard` + a Zustand game store to the SDK's
// GameSession so moves actually fire; today it just confirms the pairing + wsUrl handed over cleanly
// and falls back to GET /games/:id when someone deep-links.
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthError, NotFoundError, type GameSnapshot } from '@chess/client';
import { chessClient } from '@/lib/chess-client';
import { usePairing } from '@/lib/pairing-store';
import { useSession } from '@/lib/session-store';

type Params = { gameId: string };

type Resolved =
  | { kind: 'pairing'; color: 'w' | 'b'; opponent: string; wsUrl: string | undefined }
  | { kind: 'snapshot'; game: GameSnapshot }
  | { kind: 'loading' }
  | { kind: 'error'; message: string };

export default function GamePage({ params }: { params: Promise<Params> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const { session, logout } = useSession();
  const pairing = usePairing((s) => s.pairing);
  const clearPairing = usePairing((s) => s.clear);
  const [state, setState] = useState<Resolved>({ kind: 'loading' });

  useEffect(() => {
    if (!session) {
      router.replace('/');
      return;
    }

    // Fast path: we just got here from /matchmaking and the full match response is in the store.
    if (pairing && pairing.gameId === gameId) {
      setState({
        kind: 'pairing',
        color: pairing.color,
        opponent: pairing.opponent.username,
        wsUrl: pairing.wsUrl,
      });
      return;
    }

    // Slow path: direct link / reload — rehydrate from the gateway.
    (async () => {
      try {
        const game = await chessClient().http.getGame(gameId);
        setState({ kind: 'snapshot', game });
      } catch (err) {
        if (err instanceof NotFoundError) {
          setState({ kind: 'error', message: 'Game not found' });
          return;
        }
        if (err instanceof AuthError) {
          logout();
          router.replace('/');
          return;
        }
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' });
      }
    })();

    return () => clearPairing();
  }, [session, router, pairing, gameId, clearPairing, logout]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Game</h1>
          <p className="text-sm text-neutral-400">
            <span className="font-mono">{gameId}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Back
        </button>
      </header>

      {state.kind === 'loading' ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : null}

      {state.kind === 'pairing' ? (
        <section className="flex flex-col gap-2 text-sm">
          <p>
            You play <span className="font-mono">{state.color === 'w' ? 'White' : 'Black'}</span>{' '}
            against <span className="font-mono">{state.opponent}</span>.
          </p>
          <p className="text-neutral-400">
            WS target:{' '}
            <span className="font-mono text-neutral-500">{state.wsUrl ?? '(unknown)'}</span>
          </p>
          <p className="mt-6 rounded border border-neutral-800 bg-neutral-900 p-4 text-neutral-500">
            Board + clocks land in the next chunk.
          </p>
        </section>
      ) : null}

      {state.kind === 'snapshot' ? (
        <section className="flex flex-col gap-2 text-sm">
          <p>
            Status <span className="font-mono">{state.game.status}</span>
            {state.game.status === 'finished' ? (
              <>
                {' · '}result <span className="font-mono">{state.game.result}</span>
                {' · '}reason <span className="font-mono">{state.game.endReason}</span>
              </>
            ) : null}
          </p>
          <p className="text-neutral-400">
            White {state.game.whiteMs}ms · Black {state.game.blackMs}ms · to move{' '}
            <span className="font-mono">{state.game.turn}</span>
          </p>
          <p className="mt-6 rounded border border-neutral-800 bg-neutral-900 p-4 text-neutral-500">
            Board + clocks land in the next chunk.
          </p>
        </section>
      ) : null}

      {state.kind === 'error' ? (
        <p className="text-sm text-red-400">{state.message}</p>
      ) : null}
    </main>
  );
}
