// Login + signup, toggled on the same form. Seeded players use `pw_<username>` as their password
// (see packages/db/src/seed.ts :: seedPasswordFor); real signups pick anything ≥ 8 chars.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-store";

type Mode = "login" | "signup";

export default function Home() {
  const { session, loading, error, login, signup, logout } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (mode === "login") await login(username.trim(), password);
    else await signup(username.trim(), password);
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
            onClick={() => router.push("/matchmaking")}
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
          {mode === "login"
            ? "Sign in with your username + password."
            : "Create a new account."}
        </p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          autoFocus
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="w-fit text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
      >
        {mode === "login"
          ? "Don't have an account? Create one."
          : "Already have an account? Sign in."}
      </button>
    </main>
  );
}
