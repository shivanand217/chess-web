// Live-game state, reduced from the SDK's typed `GameEvent` stream into Zustand. The server is the
// source of truth for board + clocks; we mirror the position locally with chess.js so react-chessboard
// has a FEN to render and the Board component can give instant feedback on illegal drops.
"use client";

import { Chess, type Square } from "chess.js";
import { create } from "zustand";
import type { ConnectOpts, GameSession } from "@chess/client";
import { chessClient } from "./chess-client";
import { sounds } from "./sounds";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Phase = "idle" | "connecting" | "playing" | "ended" | "error";
type PieceLetter = "p" | "n" | "b" | "r" | "q" | "k";

export interface MoveEntry {
  uci: string;
  san: string;
}

export interface Captured {
  // Lowercase piece letters captured BY each colour.
  byWhite: PieceLetter[];
  byBlack: PieceLetter[];
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
  lastMove?: { from: string; to: string };
  selectedSquare?: string;
  legalTargets: string[];
  captured: Captured;
  inCheck: boolean;
  checkedSquare?: string;
  lastRejectedReason?: string;
  result?: "1-0" | "0-1" | "1/2-1/2";
  endReason?: "checkmate" | "stalemate" | "draw" | "flag" | "resign";
  error?: string;

  connect: (opts: Omit<ConnectOpts, "webSocketImpl">) => void;
  tryDrop: (
    from: string,
    to: string,
    promotion?: "q" | "r" | "b" | "n",
  ) => boolean;
  selectSquare: (square: string) => void;
  clearSelection: () => void;
  resign: () => void;
  disconnect: () => void;
}

/** Session + local chess + pending-move memo live outside the store so Zustand state stays
 *  serialisable and hot-reload doesn't trip on native WebSockets. */
let activeSession: GameSession | undefined;
let chess: Chess = new Chess();
let pending:
  { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } | undefined;
let hasPlayedStart = false;
let hasPlayedEnd = false;

function rebuildFromMoves(startFen: string, moves: MoveEntry[]): Chess {
  const c = new Chess(startFen);
  for (const m of moves) {
    try {
      c.move(m.san);
    } catch {
      /* server already validated — swallow and wait for next state sync */
    }
  }
  return c;
}

/** Replay the move list against a fresh position and collect everything that got taken off the
 *  board, bucketed by who captured it. Cheap enough to recompute on every state change. */
function deriveCaptured(moves: MoveEntry[]): Captured {
  const c = new Chess();
  const result: Captured = { byWhite: [], byBlack: [] };
  for (const m of moves) {
    try {
      const applied = c.move(m.san);
      if (applied.captured) {
        if (applied.color === "w")
          result.byWhite.push(applied.captured as PieceLetter);
        else result.byBlack.push(applied.captured as PieceLetter);
      }
    } catch {
      /* desynced; the next state sync will fix us */
    }
  }
  return result;
}

function kingSquare(c: Chess, color: "w" | "b"): string | undefined {
  const board = c.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.type === "k" && sq.color === color) {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return undefined;
}

function legalTargetsFrom(c: Chess, from: string): string[] {
  try {
    return c.moves({ square: from as Square, verbose: true }).map((m) => m.to);
  } catch {
    return [];
  }
}

/** Decide which sound to play for a move. `san` already encodes most of what we need. */
function soundForMove(
  san: string,
  didCapture: boolean,
  didCheck: boolean,
  isMine: boolean,
) {
  if (didCheck) {
    sounds.check();
    return;
  }
  if (san.includes("=")) {
    sounds.promote();
    return;
  }
  if (san === "O-O" || san === "O-O-O") {
    sounds.castle();
    return;
  }
  if (didCapture) {
    sounds.capture();
    return;
  }
  if (isMine) sounds.moveSelf();
  else sounds.move();
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: "idle",
  fen: START_FEN,
  turn: "w",
  whiteMs: 0,
  blackMs: 0,
  lastSyncAt: Date.now(),
  moves: [],
  legalTargets: [],
  captured: { byWhite: [], byBlack: [] },
  inCheck: false,

  connect(opts) {
    if (activeSession) {
      activeSession.close();
      activeSession = undefined;
    }
    pending = undefined;
    chess = new Chess();
    hasPlayedStart = false;
    hasPlayedEnd = false;
    set({
      phase: "connecting",
      fen: START_FEN,
      moves: [],
      lastMove: undefined,
      selectedSquare: undefined,
      legalTargets: [],
      captured: { byWhite: [], byBlack: [] },
      inCheck: false,
      checkedSquare: undefined,
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
          const inCheck = rebuilt.inCheck();
          const last = ev.state.moves.at(-1);
          const lastMove = last
            ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) }
            : undefined;
          set({
            phase: ev.state.status === "active" ? "playing" : "ended",
            myColor: ev.state.color,
            fen: rebuilt.fen(),
            turn: rebuilt.turn(),
            whiteMs: ev.state.whiteMs,
            blackMs: ev.state.blackMs,
            moves: ev.state.moves,
            lastMove,
            captured: deriveCaptured(ev.state.moves),
            inCheck,
            checkedSquare: inCheck
              ? kingSquare(rebuilt, rebuilt.turn())
              : undefined,
            lastSyncAt: Date.now(),
          });
          if (!hasPlayedStart && ev.state.status === "active") {
            sounds.gameStart();
            hasPlayedStart = true;
          }
          break;
        }
        case "move": {
          try {
            const applied = chess.move({ from: ev.from, to: ev.to });
            const didCapture = Boolean(applied.captured);
            const didCheck = chess.inCheck();
            const myColor = get().myColor;
            soundForMove(
              applied.san,
              didCapture,
              didCheck,
              applied.color === myColor,
            );
            set((s) => ({
              fen: chess.fen(),
              turn: chess.turn(),
              whiteMs: ev.whiteMs,
              blackMs: ev.blackMs,
              moves: [
                ...s.moves,
                { uci: `${ev.from}${ev.to}`, san: applied.san },
              ],
              lastMove: { from: ev.from, to: ev.to },
              captured: deriveCaptured([
                ...s.moves,
                { uci: `${ev.from}${ev.to}`, san: applied.san },
              ]),
              inCheck: didCheck,
              checkedSquare: didCheck
                ? kingSquare(chess, chess.turn())
                : undefined,
              selectedSquare: undefined,
              legalTargets: [],
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
              const didCapture = Boolean(applied.captured);
              const didCheck = chess.inCheck();
              soundForMove(applied.san, didCapture, didCheck, true);
              set((s) => ({
                fen: chess.fen(),
                turn: chess.turn(),
                whiteMs: ev.whiteMs,
                blackMs: ev.blackMs,
                moves: [...s.moves, { uci: applied.lan, san: applied.san }],
                lastMove: { from: pending!.from, to: pending!.to },
                captured: deriveCaptured([
                  ...s.moves,
                  { uci: applied.lan, san: applied.san },
                ]),
                inCheck: didCheck,
                checkedSquare: didCheck
                  ? kingSquare(chess, chess.turn())
                  : undefined,
                selectedSquare: undefined,
                legalTargets: [],
                lastSyncAt: Date.now(),
                lastRejectedReason: undefined,
              }));
            } catch {
              // Local chess.js and server disagree. Punt and wait for next state sync.
            }
          } else if (!ev.accepted) {
            sounds.illegal();
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
        case "end": {
          set({
            phase: "ended",
            result: ev.result,
            endReason: ev.endReason,
            selectedSquare: undefined,
            legalTargets: [],
          });
          if (!hasPlayedEnd) {
            hasPlayedEnd = true;
            const myColor = get().myColor;
            if (ev.result === "1/2-1/2") sounds.gameEndDraw();
            else if (
              (ev.result === "1-0" && myColor === "w") ||
              (ev.result === "0-1" && myColor === "b")
            )
              sounds.gameEndWin();
            else sounds.gameEndLoss();
          }
          break;
        }
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

    // Probe locally so bad drops bounce instantly without a server round-trip.
    const probe = new Chess(chess.fen());
    try {
      probe.move({ from, to, ...(promotion ? { promotion } : {}) });
    } catch {
      sounds.illegal();
      return false;
    }

    pending = { from, to, ...(promotion ? { promotion } : {}) };
    activeSession.sendMove(from, to, s.moves.length + 1, promotion);
    return true;
  },

  selectSquare(square) {
    const s = get();
    if (s.phase !== "playing" || !s.myColor) return;

    // Clicking a target of the current selection = commit the move.
    if (s.selectedSquare && s.legalTargets.includes(square)) {
      get().tryDrop(s.selectedSquare, square);
      return;
    }

    const piece = chess.get(square as Square);
    if (!piece || piece.color !== s.myColor || chess.turn() !== s.myColor) {
      set({ selectedSquare: undefined, legalTargets: [] });
      return;
    }
    set({
      selectedSquare: square,
      legalTargets: legalTargetsFrom(chess, square),
    });
  },

  clearSelection() {
    set({ selectedSquare: undefined, legalTargets: [] });
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
