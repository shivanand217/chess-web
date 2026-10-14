// Public profile: rating + rank + W/L/D + rating sparkline + the player's 10 most recent games.
// Open to anyone with the URL; sign-in isn't required.
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  NotFoundError,
  type GameHistoryEntry,
  type PlayerProfile,
} from "@chess/client";
import { RatingSparkline } from "@/components/rating-sparkline";
import { chessClient } from "@/lib/chess-client";

type Params = { username: string };

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

function fmtJoined(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PlayerProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await chessClient().http.getPlayerProfile(username);
        if (!cancelled) setProfile(p);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof NotFoundError)
          setError(`No player named "${username}".`);
        else
          setError(
            err instanceof Error ? err.message : "Failed to load profile.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-10 text-neutral-500">
        Loading…
      </main>
    );
  }
  if (error || !profile) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-10 text-neutral-100">
        <h1 className="text-2xl font-semibold">Player</h1>
        <p className="text-sm text-red-400">{error ?? "Not found."}</p>
        <button
          type="button"
          onClick={() => router.push("/leaderboard")}
          className="w-fit rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800"
        >
          Back to leaderboard
        </button>
      </main>
    );
  }

  const total = profile.wins + profile.losses + profile.draws;
  const winRate = total > 0 ? Math.round((profile.wins / total) * 100) : 0;

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
        {/* Header card */}
        <section className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {profile.username}
              </h1>
              <p className="mt-1 text-xs text-neutral-500">
                Joined {fmtJoined(profile.createdAt)}
              </p>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Rating
                </p>
                <p className="font-mono text-2xl text-neutral-50">
                  {profile.rating}
                </p>
              </div>
              {profile.rank !== null ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Rank
                  </p>
                  <p className="font-mono text-2xl text-neutral-50">
                    #{profile.rank}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-3 text-sm">
            <Stat label="Games" value={profile.gamesPlayed} />
            <Stat label="Wins" value={profile.wins} tone="win" />
            <Stat label="Losses" value={profile.losses} tone="loss" />
            <Stat label="Draws" value={profile.draws} />
          </div>
          {total > 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              Win rate{" "}
              <span className="font-mono text-neutral-300">{winRate}%</span>{" "}
              over {total} finished games.
            </p>
          ) : null}
        </section>

        {/* Rating chart */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Rating over time
          </h2>
          <RatingSparkline
            points={profile.ratingHistory}
            width={760}
            height={140}
          />
        </section>

        {/* Recent games */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Recent games
            </h2>
            <Link
              href="/games"
              className="text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
            >
              View all →
            </Link>
          </div>
          {profile.recentGames.length === 0 ? (
            <p className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-6 text-center text-sm text-neutral-500">
              No games yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <table className="w-full text-sm">
                <tbody>
                  {profile.recentGames.map((g) => {
                    const o = outcomeFor(g);
                    const href =
                      g.status === "active"
                        ? `/game/${g.gameId}`
                        : `/game/${g.gameId}/replay`;
                    return (
                      <tr
                        key={g.gameId}
                        className="border-t border-neutral-900/80 first:border-0 hover:bg-neutral-900/40"
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block w-10 rounded border px-1.5 py-0.5 text-center text-xs font-semibold ${TONE_STYLES[o.tone]}`}
                          >
                            {o.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-200">
                          vs{" "}
                          <Link
                            href={`/player/${encodeURIComponent(g.opponent.username)}`}
                            className="hover:underline"
                          >
                            {g.opponent.username}
                          </Link>{" "}
                          <span className="text-xs text-neutral-500">
                            ({g.opponent.ratingStart})
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-neutral-400 font-mono">
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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "win" | "loss";
}) {
  const colour =
    tone === "win"
      ? "text-emerald-300"
      : tone === "loss"
        ? "text-red-300"
        : "text-neutral-100";
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-lg ${colour}`}>{value}</p>
    </div>
  );
}
