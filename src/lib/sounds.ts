// Short synthesized blips via WebAudio so there are no mp3s to ship. Each sound is a quick envelope
// over one or two oscillators — distinct enough to tell apart without being obnoxious.
"use client";

let ctx: AudioContext | undefined;
let muted = false;

function ac(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return undefined;
    ctx = new Ctor();
  }
  // Autoplay policy: AudioContext starts suspended until a user gesture; the first user click resumes
  // it. Calling resume() every time is cheap and a no-op once running.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Blip {
  type: OscillatorType;
  freq: number;
  dur: number;
  gain?: number;
  slideTo?: number;
}

function play(blip: Blip) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = blip.type;
  osc.frequency.setValueAtTime(blip.freq, a.currentTime);
  if (blip.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      blip.slideTo,
      a.currentTime + blip.dur,
    );
  }
  const peak = blip.gain ?? 0.12;
  g.gain.setValueAtTime(0, a.currentTime);
  g.gain.linearRampToValueAtTime(peak, a.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + blip.dur);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + blip.dur + 0.02);
}

function chord(blips: Blip[]) {
  blips.forEach(play);
}

export const sounds = {
  move: () => play({ type: "triangle", freq: 440, dur: 0.08, gain: 0.08 }),
  moveSelf: () => play({ type: "triangle", freq: 520, dur: 0.08, gain: 0.1 }),
  capture: () =>
    chord([
      { type: "sawtooth", freq: 180, dur: 0.14, gain: 0.1, slideTo: 90 },
      { type: "triangle", freq: 420, dur: 0.08, gain: 0.06 },
    ]),
  check: () =>
    chord([
      { type: "square", freq: 660, dur: 0.14, gain: 0.08 },
      { type: "square", freq: 880, dur: 0.14, gain: 0.06 },
    ]),
  castle: () =>
    chord([
      { type: "triangle", freq: 300, dur: 0.1, gain: 0.08 },
      { type: "triangle", freq: 400, dur: 0.1, gain: 0.08 },
    ]),
  promote: () =>
    chord([
      { type: "sine", freq: 523, dur: 0.14, gain: 0.1 },
      { type: "sine", freq: 659, dur: 0.14, gain: 0.08 },
      { type: "sine", freq: 784, dur: 0.14, gain: 0.08 },
    ]),
  gameStart: () =>
    chord([
      { type: "sine", freq: 440, dur: 0.12, gain: 0.08 },
      { type: "sine", freq: 554, dur: 0.12, gain: 0.08 },
      { type: "sine", freq: 659, dur: 0.14, gain: 0.08 },
    ]),
  gameEndWin: () =>
    chord([
      { type: "sine", freq: 523, dur: 0.2, gain: 0.1 },
      { type: "sine", freq: 659, dur: 0.2, gain: 0.1 },
      { type: "sine", freq: 784, dur: 0.3, gain: 0.1 },
    ]),
  gameEndLoss: () =>
    chord([{ type: "sine", freq: 400, dur: 0.2, gain: 0.1, slideTo: 200 }]),
  gameEndDraw: () =>
    chord([
      { type: "sine", freq: 440, dur: 0.2, gain: 0.08 },
      { type: "sine", freq: 440, dur: 0.2, gain: 0.08 },
    ]),
  illegal: () => play({ type: "sawtooth", freq: 180, dur: 0.08, gain: 0.06 }),
};

export function setMuted(v: boolean) {
  muted = v;
}
export function isMuted() {
  return muted;
}
