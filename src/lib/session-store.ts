// Minimal Zustand store for the authenticated session. Persists to localStorage so a page reload keeps
// the user signed in; the token's own expiry (12h default) is still the authoritative lifetime.
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthSession } from '@chess/client';
import { chessClient } from './chess-client';

interface SessionState {
  session: AuthSession | undefined;
  loading: boolean;
  error: string | undefined;
  login: (playerId: string) => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: undefined,
      loading: false,
      error: undefined,
      async login(playerId) {
        set({ loading: true, error: undefined });
        try {
          const session = await chessClient().http.login(playerId);
          set({ session, loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : 'login failed' });
        }
      },
      logout() {
        chessClient().http.setSession(undefined);
        set({ session: undefined });
      },
    }),
    {
      name: 'chess-session',
      storage: createJSONStorage(() => localStorage),
      // On rehydrate, feed the restored session back into the SDK so protected calls work.
      onRehydrateStorage: () => (state) => {
        if (state?.session) chessClient().http.setSession(state.session);
      },
    },
  ),
);
