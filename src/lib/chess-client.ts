// Singleton @chess/client instance. The gateway URL is read from the env at build time — a `.env.local`
// with NEXT_PUBLIC_GATEWAY_URL points this at the running backend; the fallback matches `pnpm dev`.
import { createChessClient, type ChessClient } from '@chess/client';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000';

let instance: ChessClient | undefined;

export function chessClient(): ChessClient {
  if (!instance) instance = createChessClient({ gatewayUrl: GATEWAY_URL });
  return instance;
}
