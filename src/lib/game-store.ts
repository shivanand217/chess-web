// Live-game state, reduced from the SDK's typed `GameEvent` stream into Zustand. The server is the
// source of truth for board + clocks; we mirror the position locally with chess.js so react-chessboard
// has a FEN to render and the Board component can give instant feedback on illegal drops.
"use client";

import { Chess } from "chess.js";
import { create } from "zustand";
import type { ConnectOpts, GameSession } from "@chess/client";
import { chessClient } from "./chess-client";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Phase = "idle" | "connecting" | "playing" | "ended" | "error";

export interface MoveEntry {
  uci: string;
  san: string;
}

interface GameStoreState {
  phase: Phase;
  myColor?: "w" | "b";
  fen: string;
  turn: "w" | "b";
  whiteMs: number;
  blackMs: number;
  lastSyncAt: number;
  moves: MoveEntry[];
  lastRejectedReason?: string;
  result?: "1-0" | "0-1" | "1/2-1/2";
  endReason?: "checkmate" | "stalemate" | "draw" | "flag" | "resign";
  error?: string;

  connect: (opts: Omit<ConnectOpts, "webSocketImpl">) => void;
  /** Returns true if the drop was accepted by local validation (and sent to the server). The actual
   *  server verdict arrives later as an `ack` event. */
  tryDrop: (
    from: string,
    to: string,
    promotion?: "q" | "r" | "b" | "n",
  ) => boolean;
  resign: () => void;
  disconnect: () => void;
}

/** The session handle + local chess instance + pending-move memo all live outside the store so Zustand
 *  state stays serialisable (and so hot-reload doesn't trip on native WebSockets). */
let activeSession: GameSession | undefined;
let chess: Chess = new Chess();
let pending:
  { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } | undefined;

function rebuildFromMoves(startFen: string, moves: MoveEntry[]): Chess {
  const c = new Chess(startFen);
  for (const m of moves) {
    try {
      c.move(m.san);
    } catch {
      // Server already validated — if we can't replay, the view is desynced; swallow and let the
      // next full `state` sync us back.
    }
  }
  return c;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: "idle",
  fen: START_FEN,
  turn: "w",
  whiteMs: 0,
  blackMs: 0,
  lastSyncAt: Date.now(),
  moves: [],

  connect(opts) {
    if (activeSession) {
      activeSession.close();
      activeSession = undefined;
    }
    pending = undefined;
    chess = new Chess();
    set({
      phase: "connecting",
      fen: START_FEN,
      moves: [],
      error: undefined,
      lastRejectedReason: undefined,
      result: undefined,
      endReason: undefined,
    });

    const session = chessClient().connectToGame(opts);
    activeSession = session;

    session.on((ev) => {
      switch (ev.type) {
        case "state": {
          const rebuilt = rebuildFromMoves(ev.state.fen, ev.state.moves);
          chess = rebuilt;
          set({
            phase: ev.state.status === "active" ? "playing" : "ended",
            myColor: ev.state.color,
            fen: rebuilt.fen(),
            turn: rebuilt.turn(),
            whiteMs: ev.state.whiteMs,
            blackMs: ev.state.blackMs,
            moves: ev.state.moves,
            lastSyncAt: Date.now(),
          });
          break;
        }
        case "move": {
          try {
            const applied = chess.move({ from: ev.from, to: ev.to });
            set((s) => ({
              fen: chess.fen(),
              turn: chess.turn(),
              whiteMs: ev.whiteMs,
              blackMs: ev.blackMs,
              moves: [
                ...s.moves,
                { uci: `${ev.from}${ev.to}`, san: applied.san },
              ],
              lastSyncAt: Date.now(),
            }));
          } catch {
            set({ error: "opponent move desynced; waiting for state" });
          }
          break;
        }
        case "ack": {
          if (ev.accepted && pending) {
            try {
              const applied = chess.move({
                from: pending.from,
                to: pending.to,
                ...(pending.promotion ? { promotion: pending.promotion } : {}),
              });
              set((s) => ({
                fen: chess.fen(),
                turn: chess.turn(),
                whiteMs: ev.whiteMs,
                blackMs: ev.blackMs,
                moves: [...s.moves, { uci: applied.lan, san: applied.san }],
                lastSyncAt: Date.now(),
                lastRejectedReason: undefined,
              }));
            } catch {
              // Our local chess.js and the server disagree. Punt and wait for the next state sync.
            }
          } else if (!ev.accepted) {
            set({
              lastRejectedReason: ev.reason ?? "rejected",
              whiteMs: ev.whiteMs,
              blackMs: ev.blackMs,
              lastSyncAt: Date.now(),
            });
          }
          pending = undefined;
          break;
        }
        case "end":
          set({ phase: "ended", result: ev.result, endReason: ev.endReason });
          break;
        case "error":
          set({ phase: "error", error: `${ev.code}: ${ev.message}` });
          break;
        case "closed":
          if (ev.code !== 1000 && get().phase === "playing") {
            set({ phase: "error", error: `socket closed (${ev.code})` });
          }
          break;
      }
    });
  },

  tryDrop(from, to, promotion) {
    const s = get();
    if (!activeSession || s.phase !== "playing") return false;
    if (chess.turn() !== s.myColor) return false;

    // Probe locally so the UI gives instant feedback on obviously illegal drops without a round-trip.
    const probe = new Chess(chess.fen());
    try {
      probe.move({ from, to, ...(promotion ? { promotion } : {}) });
    } catch {
      return false;
    }

    pending = { from, to, ...(promotion ? { promotion } : {}) };
    activeSession.sendMove(from, to, s.moves.length + 1, promotion);
    return true;
  },

  resign() {
    activeSession?.resign();
  },

  disconnect() {
    if (activeSession) {
      activeSession.close();
      activeSession = undefined;
    }
    pending = undefined;
    set({ phase: "idle" });
  },
}));
