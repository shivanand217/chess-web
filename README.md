# chess-web

Browser UI for the chess platform. Next.js 15 App Router, React 19, Tailwind
v4, Zustand, `react-chessboard`. The backend lives at `../Chess` and this app
talks to its gateway on `:3000`; the typed SDK (`@chess/client`) is pulled
in by `link:` so I can edit the SDK and hot-reload the UI without publishing.

## What's in here

- **Login + signup** on `/` — one form that toggles. Hits `/auth/token` or
  `/auth/signup` on the gateway, stashes the HS256 JWT.
- **Matchmaking** on `/matchmaking` — held long-poll with a seconds counter
  and a cancel. The in-flight request lives in a Zustand store so React
  Strict Mode's double-mount in dev can't fire it twice. That bug paired
  each player with their own duplicate request. Fixed in
  `src/lib/matchmaking-store.ts` via a module-level `AbortController`.
- **Game** on `/game/[gameId]` — board wired to a Zustand store that
  reduces the SDK's typed `GameEvent` stream (`gameState` / `move` / `ack`
  / `end`). Server-authoritative clocks ticked on the client between
  updates, in-check indicator, win/lose/draw banner, promotion dialog
  (hold-and-pick, not auto-queen), move list, resign.
- **Leaderboard** on `/leaderboard` — paginated top-N with the signed-in
  player's row highlighted.

## Prerequisites

Node 22 LTS, pnpm (via `corepack enable`), and `../Chess` running on
`localhost:3000`.

## Running

### One command, both repos

The `../Chess` repo has a boot script that brings up compose, applies
migrations, seeds the DB, starts all five backend services, and starts
this app:

```bash
~/Documents/bck-works/Chess/tools/boot-stack.sh
```

Variants:

```bash
STOP=1      ...boot-stack.sh    # tear everything down
SKIP_WEB=1  ...boot-stack.sh    # backend only (if I want to run `pnpm dev` here manually)
OBS=1       ...boot-stack.sh    # also Prometheus / Grafana / Tempo
```

Service logs land in `/tmp/chess-logs/<svc>.log`. This app's is
`/tmp/chess-logs/web.log`.

### Just the frontend

If the backend is already up:

```bash
cd ~/Documents/bck-works/chess-web
pnpm install
cp .env.example .env.local    # points at http://localhost:3000 by default
pnpm dev                       # :4000
```

Open http://localhost:4000.

### Signing in

The seed in `../Chess` creates `player_000000` … `player_000019`.
The password is `pw_` + the username:

- Username `player_000000`
- Password `pw_player_000000`

Or click **Create one** and sign up — any username matching
`^[a-zA-Z0-9_-]{3,32}$` with a password ≥ 8 chars.

### Playing a game

Open two windows (one incognito, so sessions don't share localStorage).
Sign in as two different seeded players. Both click **Find a match**.
Both windows land on `/game/<same-uuid>` within a second.

## Scripts

- `pnpm dev` — `next dev -p 4000`
- `pnpm build` — production build to `.next/`
- `pnpm start` — serve the production build on `:4000`
- `pnpm lint` — `next lint`
- `pnpm typecheck` — `tsc --noEmit`

## Layout

```
src/
├── app/
│   ├── layout.tsx                   root + globals.css
│   ├── page.tsx                     login + signup toggle
│   ├── matchmaking/page.tsx         long-poll + cancel
│   ├── game/[gameId]/page.tsx       board + clocks + banners + resign
│   └── leaderboard/page.tsx         top-N table
├── components/
│   ├── board.tsx                    react-chessboard + promotion flow
│   ├── clock.tsx                    server-authoritative, locally ticked
│   ├── move-list.tsx                SAN pairs, auto-scrolls
│   ├── promotion-dialog.tsx         Q/R/B/N picker
│   └── game-banner.tsx              CheckBanner + GameEndBanner
└── lib/
    ├── chess-client.ts              @chess/client singleton
    ├── session-store.ts             auth session, persisted
    ├── matchmaking-store.ts         long-poll + module-level dedupe
    └── game-store.ts                GameEvent reducer + local chess.js mirror
```

## Linking against the backend SDK

The SDK isn't published anywhere — I just point at the source. In
`package.json`:

```jsonc
"dependencies": {
  "@chess/client":   "link:../Chess/packages/client",
  "@chess/protocol": "link:../Chess/packages/protocol"
},
"pnpm": {
  // The SDK's own package.json uses `workspace:*` for its internal deps.
  // Outside its home workspace that'd error, so these overrides rewrite
  // those references to the same link: paths.
  "overrides": {
    "@chess/client":   "link:../Chess/packages/client",
    "@chess/protocol": "link:../Chess/packages/protocol"
  }
}
```

Two Next tweaks (`next.config.mjs`) make this work:

- `transpilePackages: ['@chess/client', '@chess/protocol']` — the SDK ships
  TypeScript source, not compiled `.js`. SWC compiles it on demand.
- `webpack.resolve.extensionAlias: { '.js': ['.ts', '.tsx', '.js', '.jsx'] }`
  — the SDK uses TS-ESM `.js` imports internally. Webpack takes those
  literally by default and resolution fails. This gives it the TS
  compiler's semantics.

## Known rough edges

- No WS auto-reconnect. A dropped socket shows a red banner; refresh
  reconnects via `GET /games/:id`.
- Sticky localStorage session. Reloads keep you signed in until the JWT's
  12 h expiry. Sign out explicitly to clear.
- No optimistic move animation. Moves animate on the server ack — fine on
  a LAN, visible lag on a slow connection. Local chess.js still validates
  obvious illegality first so bad drops bounce instantly.

## Troubleshooting

- **"Failed to fetch" on sign-in** — the gateway isn't up.
  `curl localhost:3000/healthz` from the `../Chess` side.
- **CORS error in the console** — the gateway's `CORS_ORIGINS` doesn't
  include this origin. Dev defaults to `http://localhost:4000`.
- **Both players matching with themselves** — React Strict Mode fired the
  matchmaking request twice. Fixed on `main`; pull if you've forked an
  older state.
- **`ERR_PNPM_IGNORED_BUILDS: unrs-resolver`** — pnpm 11 asks you to
  approve build scripts. `pnpm-workspace.yaml` pins the allowlist; if pnpm
  rewrote it with a placeholder, overwrite with:
  ```yaml
  onlyBuiltDependencies:
    - unrs-resolver
  ```
- **Blank screen or 500 on `/game/<uuid>`** — usually the `@chess/*`
  symlinks got nuked by a reinstall. `pnpm install` again from this
  directory re-creates them.
