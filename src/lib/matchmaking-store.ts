// Matchmaking state + the long-poll in flight. Lives outside React's lifecycle because dev-mode
// Strict Mode double-mounts every effect; without this dedupe, each page mount would fire a *second*
// `findMatch` request and the matchmaker would happily pair a player with themselves across the two
// requestIds. (The server dedupes by requestId, not by playerId.)
"use client";

import { create } from "zustand";
import { AuthError, MatchmakingTimeoutError } from "@chess/client";
import type { MatchmakingResponse } from "@chess/protocol";
import { chessClient } from "./chess-client";

export type MatchmakingStatus =
  | "idle"
  | "searching"
  | "matched"
  | "timeout"
  | "cancelled"
  | "error"
  | "auth_expired";

interface MatchmakingState {
  status: MatchmakingStatus;
  pairing?: MatchmakingResponse;
  error?: string;

  start: (timeControl: string) => void;
  cancel: () => void;
  reset: () => void;
}

/** The in-flight AbortController. Module-level so re-renders / strict-mode remounts can't double-fire. */
let inflight: AbortController | undefined;

export const useMatchmaking = create<MatchmakingState>((set) => ({
  status: "idle",

  start(timeControl) {
    if (inflight) return; // dedupe — effect ran twice, same intent
    const controller = new AbortController();
    inflight = controller;
    set({ status: "searching", pairing: undefined, error: undefined });

    chessClient()
      .http.findMatch(timeControl, controller.signal)
      .then((pairing) => {
        if (!controller.signal.aborted) set({ status: "matched", pairing });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          set({ status: "cancelled" });
          return;
        }
        if (err instanceof MatchmakingTimeoutError) {
          set({ status: "timeout" });
          return;
        }
        if (err instanceof AuthError) {
          set({ status: "auth_expired" });
          return;
        }
        set({
          status: "error",
          error: err instanceof Error ? err.message : "unknown",
        });
      })
      .finally(() => {
        if (inflight === controller) inflight = undefined;
      });
  },

  cancel() {
    inflight?.abort();
    inflight = undefined;
    set({ status: "cancelled" });
  },

  reset() {
    inflight = undefined;
    set({ status: "idle", pairing: undefined, error: undefined });
  },
}));
