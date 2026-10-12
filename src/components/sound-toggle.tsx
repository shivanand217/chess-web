// Little speaker button that mutes/unmutes the WebAudio sounds. Persists via localStorage so the
// choice survives reloads.
"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sounds";

const KEY = "chess-sound-muted";

export function SoundToggle() {
  const [muted, setLocal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY) === "1";
      setMuted(stored);
      setLocal(stored);
    } catch {
      /* localStorage unavailable — carry on unmuted */
    }
  }, []);

  const toggle = () => {
    const next = !isMuted();
    setMuted(next);
    setLocal(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute" : "Mute"}
      className="flex h-8 w-8 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
      title={muted ? "Unmute sounds" : "Mute sounds"}
    >
      {muted ? "\u{1F507}" : "\u{1F509}"}
    </button>
  );
}
