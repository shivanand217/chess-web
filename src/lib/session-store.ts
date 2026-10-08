// Zustand store for the authenticated session. Persists to localStorage so a page reload keeps the
// user signed in; the token's own expiry (12h default) is still the authoritative lifetime.
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthSession } from '@chess/client';
import { chessClient } from './chess-client';

interface SessionState {
  session: AuthSession | undefined;
  loading: boolean;
  error: string | undefined;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

async function run(
  set: (partial: Partial<SessionState>) => void,
  op: () => Promise<AuthSession>,
): Promise<void> {
  set({ loading: true, error: undefined });
  try {
    const session = await op();
    set({ session, loading: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'request failed';
    set({ loading: false, error: message });
  }
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: undefined,
      loading: false,
      error: undefined,
      login: (username, password) => run(set, () => chessClient().http.login(username, password)),
      signup: (username, password) =>
        run(set, () => chessClient().http.signup(username, password)),
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
