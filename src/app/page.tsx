// Landing page. Signed-out: login/signup form on a card. Signed-in: a hero with the main actions.
// Seeded players use `pw_<username>` as their password (see packages/db/src/seed.ts).
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chessClient } from "@/lib/chess-client";
import { useSession } from "@/lib/session-store";

type Mode = "login" | "signup";

export default function Home() {
  const { session, loading, error, login, signup, logout } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<
    { rating: number; rank: number | null } | undefined
  >();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      setStats(undefined);
      return;
    }
    let cancelled = false;
    chessClient()
      .http.getPlayerRank(session.playerId)
      .then((r) => {
        if (!cancelled) setStats({ rating: r.rating, rank: r.rank });
      })
      .catch(() => {
        /* leaderboard offline or player not yet ranked — just hide */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (mode === "login") await login(username.trim(), password);
    else await signup(username.trim(), password);
  };

  if (session) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto flex max-w-3xl flex-col gap-10 p-10">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Chess</h1>
            <button
              type="button"
              onClick={logout}
              className="rounded border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900"
            >
              Sign out
            </button>
          </header>

          <section className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-8">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Signed in
            </p>
            <h2 className="mt-1 text-xl font-medium">{session.username}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Rating{" "}
              <span className="font-mono text-neutral-200">
                {stats?.rating ?? "…"}
              </span>
              {stats && stats.rank !== null ? (
                <span className="ml-3">
                  Rank{" "}
                  <span className="font-mono text-neutral-200">
                    #{stats.rank}
                  </span>
                </span>
              ) : null}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/matchmaking")}
                className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/40 hover:bg-emerald-500"
              >
                Play
              </button>
              <Link
                href="/leaderboard"
                className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900"
              >
                Leaderboard
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl shadow-black/40">
        <h1 className="text-2xl font-semibold tracking-tight">Chess</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {mode === "login" ? "Sign in to play." : "Create a new account."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600 focus:border-emerald-600 focus:outline-none"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm placeholder:text-neutral-600 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-fit text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
        >
          {mode === "login"
            ? "Don't have an account? Create one."
            : "Already have an account? Sign in."}
        </button>
      </div>
    </main>
  );
}
