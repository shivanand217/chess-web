// Landing + dev login. Paste a known playerId (from seed data) and get a JWT. Once auth has real
// password flows we'll replace this with a username/password form.
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session-store';

export default function Home() {
  const { session, loading, error, login, logout } = useSession();
  const [playerId, setPlayerId] = useState('');
  const router = useRouter();

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await login(playerId.trim());
  };

  if (session) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-6 p-10">
        <header>
          <h1 className="text-2xl font-semibold">Chess</h1>
          <p className="text-sm text-neutral-400">
            Signed in as <span className="font-mono">{session.username}</span>
          </p>
        </header>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/matchmaking')}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
          >
            Find a match
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-2xl font-semibold">Chess</h1>
        <p className="text-sm text-neutral-400">
          Dev login. Paste a seeded <span className="font-mono">playerId</span> to mint a JWT.
        </p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="playerId (UUID)"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !playerId}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error ? (
          <p className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
