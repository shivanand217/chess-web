# chess-web

Frontend for the Chess platform. Next.js 15 App Router + React 19 + Tailwind v4 + Zustand.

Consumes the typed SDK from the sibling [Chess](../Chess) repo via a `file:` link, so a dev running
both can edit the server-side SDK and hot-reload the UI without publishing.

## Running

```
cp .env.example .env.local        # points at http://localhost:3000 by default
pnpm install
pnpm dev                           # starts next on :4000
```

The backend has to be running — bring it up from the sibling repo:

```
cd ../Chess
pnpm stack:up
pnpm --filter @chess/db exec drizzle-kit migrate
pnpm --filter @chess/db db:seed
pnpm --filter @chess/matchmaker dev
pnpm --filter @chess/session-router dev
pnpm --filter @chess/game-server dev
pnpm --filter @chess/gateway dev
```

Open http://localhost:4000. Paste a seeded `playerId` (any UUID from the `players` table) and the
form mints a JWT via the gateway's `/auth/token`.

## Structure

```
chess-web/
├── src/
│   ├── app/
│   │   ├── layout.tsx            root layout (globals.css import)
│   │   ├── globals.css           Tailwind v4 @theme + base styles
│   │   └── page.tsx              login / landing
│   └── lib/
│       ├── chess-client.ts       @chess/client singleton
│       └── session-store.ts      Zustand store, localStorage-backed
├── next.config.mjs               transpilePackages for @chess/*
├── postcss.config.mjs            Tailwind v4 PostCSS plugin
└── tsconfig.json
```

## Cross-repo linking

`package.json` references the backend's SDK as:

```json
"dependencies": {
  "@chess/client":   "file:../Chess/packages/client",
  "@chess/protocol": "file:../Chess/packages/protocol"
}
```

Both are needed — the SDK's internal `workspace:*` reference to `@chess/protocol` is resolved by
pnpm reading the explicit `file:` entry at install time. `next.config.mjs` adds both to
`transpilePackages` so Next's SWC compiles their TypeScript source.
