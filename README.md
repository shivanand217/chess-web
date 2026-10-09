# chess-web

Frontend for the Chess platform. Next.js 15 App Router + React 19 + Tailwind v4 + Zustand +
`react-chessboard`. Consumes the typed SDK (`@chess/client`) from the sibling
[Chess](../Chess) repo via a `link:` reference, so running both locally lets you edit the
server-side SDK and hot-reload the UI without publishing.

## What's in here

- **Login / signup** on `/` — username + password form, toggles between sign-in and new-account.
  The gateway's `/auth/token` returns an HS256 JWT; `/auth/signup` creates a player row with a
  bcrypt-hashed password and returns a token too.
- **Matchmaking** on `/matchmaking` — held long-poll with a live seconds counter and a cancel
  button. The in-flight request lives in a Zustand store so React 19's Strict Mode double-mount
  can't fire it twice (that bug paired each player with their own second request).
- **Game** on `/game/[gameId]` — `react-chessboard` wired to a Zustand game store that reduces
  the SDK's typed `GameEvent` stream (gameState, move, ack, end). Server-authoritative clocks
  with client-side ticking, live "You are in check" indicator, win / lose / draw banner on game
  end, resign button.

## Prerequisites

| Tool | Version  |
| ---- | -------- |
| Node | ≥ 22 LTS |
| pnpm | 10+      |

The backend has to be reachable at `http://localhost:3000`. Bring it up first (see the sibling
repo's README).

## Running from scratch

```bash
# 1. One-time install (also after a pull that touches deps)
cd ~/Documents/bck-works/chess-web
pnpm install

# 2. Point the frontend at the gateway (dev default is http://localhost:3000)
cp .env.example .env.local

# 3. Start Next in dev — hot reloads on file save
pnpm dev                             # :4000
```

Open **http://localhost:4000**.

### Sign in with a seeded account

The backend seed creates `player_000000` … `player_000019` with the password convention
`pw_<username>`. So:

- Username `player_000000`
- Password `pw_player_000000`

Or click **"Don't have an account? Create one."** and sign up — any username matching
`^[a-zA-Z0-9_-]{3,32}$` with a password ≥ 8 chars.

### Play a game

1. Open **http://localhost:4000** in two browser windows (one in incognito, so the sessions
   don't share localStorage).
2. Sign in as different seeded players (e.g. `player_000000` and `player_000001`).
3. Both click **Find a match**. Both windows land on `/game/<same-uuid>` within a second or two.
4. Move a piece in one window → it animates in the other. Clocks swap. In-check and
   game-end banners fire client-side off `chess.js`.

### Full stack start — backend side

From the sibling repo (see [`../Chess/README.md`](../Chess/README.md) for all the
troubleshooting detail):

```bash
cd ~/Documents/bck-works/Chess
pnpm stack:up                                                   # Postgres + Redis + etcd
pnpm --filter @chess/db exec drizzle-kit migrate                # once per fresh DB
SEED_COUNT=20 pnpm --filter @chess/db db:seed                   # once per fresh DB
pnpm --filter @chess/matchmaker dev     &                       # :3001
pnpm --filter @chess/session-router dev &                       # :3002
pnpm --filter @chess/game-server dev    &                       # :3003
pnpm --filter @chess/gateway dev        &                       # :3000
# (leaderboard on :3004 is optional for play)
```

## Scripts

|                  |                                       |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | `next dev -p 4000`, hot-reload        |
| `pnpm build`     | production build to `.next/`          |
| `pnpm start`     | serve the production build on `:4000` |
| `pnpm lint`      | `next lint`                           |
| `pnpm typecheck` | `tsc --noEmit`                        |

## Structure

```
chess-web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                root layout (imports globals.css)
│   │   ├── globals.css               Tailwind v4 @theme + base styles
│   │   ├── page.tsx                  login + signup form (toggle)
│   │   ├── matchmaking/page.tsx      held long-poll, cancel, retry
│   │   └── game/[gameId]/page.tsx    board + clocks + banners + resign
│   ├── components/
│   │   ├── board.tsx                 react-chessboard wrapper
│   │   ├── clock.tsx                 server-authoritative clock w/ live tick
│   │   └── game-banner.tsx           CheckBanner + GameEndBanner
│   └── lib/
│       ├── chess-client.ts           @chess/client singleton
│       ├── session-store.ts          auth session, persisted to localStorage
│       ├── matchmaking-store.ts      long-poll state + module-level dedupe
│       └── game-store.ts             GameEvent reducer, local chess.js mirror
├── next.config.mjs                   transpilePackages + .js↔.ts aliasing
├── postcss.config.mjs                Tailwind v4 PostCSS plugin
├── pnpm-workspace.yaml               pnpm 11 build-script allowlist
└── tsconfig.json
```

## Cross-repo linking

`package.json` points at the sibling repo's SDK via pnpm's `link:` protocol:

```jsonc
"dependencies": {
  "@chess/client":   "link:../Chess/packages/client",
  "@chess/protocol": "link:../Chess/packages/protocol"
},
"pnpm": {
  // The SDK's own package.json uses `workspace:*` for its internal deps; outside its home
  // workspace that would error. These overrides rewrite the references to the sibling paths.
  "overrides": {
    "@chess/client":   "link:../Chess/packages/client",
    "@chess/protocol": "link:../Chess/packages/protocol"
  }
}
```

Two Next-config tweaks make this work ([`next.config.mjs`](next.config.mjs)):

1. `transpilePackages: ['@chess/client', '@chess/protocol']` — tells Next's SWC to compile the
   TypeScript source (the SDK ships `.ts`, not `.js`).
2. `webpack.resolve.extensionAlias: { '.js': ['.ts', '.tsx', '.js', '.jsx'] }` — the SDK uses
   TS-ESM `.js` imports; webpack takes them literally by default and resolution fails. This
   gives it the TS compiler's semantics.

## Known rough edges

- **Promotion is auto-queen** — no dialog yet. Pawn to the back rank always promotes to a
  queen.
- **No move-list panel** — the game store carries `moves[]` but nothing renders it.
- **No WS auto-reconnect** — a dropped socket shows a red error banner; refreshing the page
  reconnects via `GET /games/:id`.
- **localStorage sticky session** — a browser reload keeps you signed in until the JWT's
  12 h expiry. Sign out explicitly to clear.
- **No optimistic move animation** — moves animate when the server acks (feels fine on a LAN;
  on a slow connection you'll notice the latency). Local chess.js validates obvious illegality
  before sending, so you get instant feedback on bad drops.

## Troubleshooting

- **"Failed to fetch" on sign-in** → the gateway isn't up. `curl localhost:3000/healthz` from
  the Chess repo side.
- **CORS error in the console** → the gateway's `CORS_ORIGINS` doesn't include the frontend's
  origin. Dev defaults to `http://localhost:4000`; see the Chess repo's config.
- **"Both players matched with themselves"** → React Strict Mode double-fired the matchmaking
  request. Fixed in this repo on `main` via `lib/matchmaking-store.ts`. If you've forked an
  older state, pull.
- **`ERR_PNPM_IGNORED_BUILDS: unrs-resolver`** → pnpm 11 asks you to approve build scripts.
  The repo pins the allowlist in `pnpm-workspace.yaml`; if it got rewritten with a placeholder,
  overwrite with:
  ```yaml
  onlyBuiltDependencies:
    - unrs-resolver
  ```
- **Blank screen / 500 on `/game/<uuid>`** → check `pnpm dev`'s terminal. Usually the `@chess/*`
  symlinks got nuked by a reinstall. `pnpm install` again from this directory re-creates them.
