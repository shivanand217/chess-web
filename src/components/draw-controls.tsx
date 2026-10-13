// Three states in one component, driven off `drawOfferFrom`:
//   1. no offer standing → "Offer draw" button
//   2. opponent offered → "Opponent offers a draw" + Accept / Decline buttons
//   3. we offered → "Draw offered — waiting…" with a dim cancel-looking label
// Plus a short-lived "Draw declined" chip after `drawDeclinedAt` is stamped.
"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/game-store";

export function DrawControls() {
  const phase = useGameStore((s) => s.phase);
  const myColor = useGameStore((s) => s.myColor);
  const drawOfferFrom = useGameStore((s) => s.drawOfferFrom);
  const drawDeclinedAt = useGameStore((s) => s.drawDeclinedAt);
  const offerDraw = useGameStore((s) => s.offerDraw);
  const respondDraw = useGameStore((s) => s.respondDraw);
  const dismiss = useGameStore((s) => s.dismissDrawDeclined);

  // Auto-clear the "declined" chip after a few seconds so it doesn't linger forever.
  useEffect(() => {
    if (!drawDeclinedAt) return;
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [drawDeclinedAt, dismiss]);

  if (phase !== "playing" || !myColor) return null;

  // Opponent has offered — show accept / decline.
  if (drawOfferFrom && drawOfferFrom !== myColor) {
    return (
      <div className="rounded-md border border-amber-700/60 bg-amber-950/40 p-3">
        <p className="text-sm font-medium text-amber-100">
          Opponent offers a draw.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => respondDraw(true)}
            className="flex-1 rounded-md border border-emerald-700 bg-emerald-900/60 px-3 py-1.5 text-sm font-medium text-emerald-100 hover:bg-emerald-800"
          >
            Accept draw
          </button>
          <button
            type="button"
            onClick={() => respondDraw(false)}
            className="flex-1 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  // We've offered — show waiting state. No cancel: FIDE offers can't be withdrawn, so the UI
  // mirrors that.
  if (drawOfferFrom === myColor) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
        Draw offered — waiting for opponent.
      </div>
    );
  }

  // No standing offer. Show the "offer" button + the recently-declined chip when relevant.
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={offerDraw}
        className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        Offer draw
      </button>
      {drawDeclinedAt ? (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-1.5 text-xs text-amber-300">
          Your draw offer was declined.
        </p>
      ) : null}
    </div>
  );
}
