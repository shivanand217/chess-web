// Transient store for the most recently paired match. The matchmaking page writes it on success and the
// game page reads it on first render; a reload or a direct-link navigation falls back to GET /games/:id.
'use client';

import { create } from 'zustand';
import type { MatchmakingResponse } from '@chess/protocol';

interface PairingState {
  pairing: MatchmakingResponse | undefined;
  set: (p: MatchmakingResponse) => void;
  clear: () => void;
}

export const usePairing = create<PairingState>((set) => ({
  pairing: undefined,
  set: (p) => set({ pairing: p }),
  clear: () => set({ pairing: undefined }),
}));
