# Production image for the Next.js frontend. The SDK (@chess/client, @chess/protocol) is referenced
# via `link:../Chess/packages/...`, so this Dockerfile expects to be built from a parent directory
# containing BOTH `Chess/` and `chess-web/` side-by-side:
#
#   cd ~/Documents/bck-works
#   docker build -f chess-web/Dockerfile \
#     --build-arg NEXT_PUBLIC_GATEWAY_URL=https://chess-gateway-xxx.a.run.app \
#     -t <registry>/chess-web:<tag> .
#
# NEXT_PUBLIC_* is baked into the Next bundle at build time, so it must be a build arg (not a
# runtime env var — Next ignores runtime NEXT_PUBLIC_*).
FROM node:22-slim AS build
WORKDIR /src
RUN corepack enable
ARG NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL

# Pull in the SDK source and the frontend. Both come from the build context (the parent dir).
COPY Chess/package.json Chess/pnpm-workspace.yaml Chess/pnpm-lock.yaml Chess/.npmrc Chess/tsconfig.base.json Chess/
COPY Chess/packages Chess/packages
COPY chess-web/package.json chess-web/pnpm-workspace.yaml chess-web/pnpm-lock.yaml chess-web/
WORKDIR /src/chess-web
RUN pnpm install --frozen-lockfile

# Now copy the rest of the frontend and build.
COPY chess-web/ ./
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# `output: 'standalone'` emits a self-contained server + the minimal node_modules it needs. Copy
# that plus the public and static assets (which standalone does NOT bundle).
COPY --from=build /src/chess-web/.next/standalone ./
COPY --from=build /src/chess-web/.next/static ./.next/static
COPY --from=build /src/chess-web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
