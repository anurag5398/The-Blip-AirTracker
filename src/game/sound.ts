import type { Rarity } from '../../shared/aircraft';

// Just-intonation-friendly major chords, rooted on C. Rarer catches climb higher and shimmer more.
const ROOT = 261.63;
const SCALE = [1, 5 / 4, 3 / 2, 2];
const RARITY_OCTAVE: Record<Rarity, number> = { common: 1, rare: 1.25, epic: 1.5, legendary: 2 };

const MASTER = 0.55;
const ECHO_SEND = 0.28;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let echoSend: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = true;

/** Creates the audio graph. Must run from a user gesture, otherwise browsers keep it suspended. */
export function unlockAudio() {
  if (typeof AudioContext === 'undefined' || ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER;
  master.connect(ctx.destination);

  // Soft feedback echo gives every cue a sense of space
  echoSend = ctx.createGain();
  echoSend.gain.value = ECHO_SEND;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.26;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2_800;
  echoSend.connect(delay);
  delay.connect(tone).connect(feedback).connect(delay);
  tone.connect(master);

  // One second of white noise, reused by whooshes
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setMuted(on: boolean) {
  muted = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0 : MASTER, ctx.currentTime, 0.05);
}

interface ToneOpts {
  type?: OscillatorType;
  peak?: number;
  echo?: boolean;
  attack?: number;
  glideTo?: number;
}

function tone(freq: number, start: number, dur: number, opts: ToneOpts = {}) {
  if (!ctx || !master) return;
  const { type = 'sine', peak = 0.16, echo = true, attack = 0.012, glideTo } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(master);
  if (echo && echoSend) gain.connect(echoSend);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function chord(freqs: number[], start: number, dur: number, peak: number) {
  for (const f of freqs) tone(f, start, dur, { peak, type: 'triangle', attack: 0.04 });
}

function whoosh(start: number, dur: number, from: number, to: number, peak: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(from, start);
  band.frequency.exponentialRampToValueAtTime(to, start + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(band).connect(gain).connect(master);
  src.start(start);
  src.stop(start + dur + 0.05);
}

/** A catch: a rising arpeggio that climbs with rarity and combo, with a shimmer chord on the rarer ones. */
export function playCatchSound(rarity: Rarity, multiplier = 1) {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const base = ROOT * RARITY_OCTAVE[rarity] * (1 + (multiplier - 1) * 0.05);
  SCALE.forEach((ratio, i) => tone(base * ratio, t + i * 0.07, 0.35, { peak: 0.14 }));
  if (rarity !== 'common') chord([base * 2, base * 2.5, base * 3], t + 0.28, 0.9, 0.06);
}

/** Something rare entered view: a bright two-note sparkle. */
export function playSpawnSound(rarity: Rarity) {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const f = ROOT * 4 * RARITY_OCTAVE[rarity];
  tone(f, t, 0.2, { type: 'triangle', peak: 0.09 });
  tone(f * 1.5, t + 0.08, 0.3, { type: 'triangle', peak: 0.09 });
}

/** A squawk alert: two rising-and-falling sweeps. */
export function playSiren() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(660, t, 0.6, { type: 'sawtooth', peak: 0.05, glideTo: 880, echo: false });
  tone(880, t + 0.6, 0.6, { type: 'sawtooth', peak: 0.05, glideTo: 660, echo: false });
}

/** Bounty posted: a pulsing alarm, three beats. */
export function playBountySound() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) tone(988, t + i * 0.22, 0.14, { type: 'square', peak: 0.06, echo: false });
}

/** Bounty escaped: a falling sigh. */
export function playEscapeSound() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(392, t, 0.7, { type: 'triangle', peak: 0.14, glideTo: 196 });
  tone(311, t + 0.25, 0.6, { type: 'triangle', peak: 0.07, glideTo: 156 });
}

/** Shift won: a rising major fanfare with a big chord and a shimmer. Euphoric on purpose. */
export function playWinSound() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [ROOT, ROOT * 1.25, ROOT * 1.5, ROOT * 2, ROOT * 2.5, ROOT * 3].forEach((f, i) =>
    tone(f, t + i * 0.09, 0.5, { peak: 0.13 }),
  );
  chord([ROOT * 2, ROOT * 2.5, ROOT * 3, ROOT * 4], t + 0.6, 1.6, 0.08);
  whoosh(t + 0.5, 1.0, 800, 6_000, 0.05);
}

/** Shift lost: a soft minor descent. Sad, not punishing. */
export function playLossSound() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [ROOT * 1.5, ROOT * 1.2, ROOT, ROOT * 0.8].forEach((f, i) =>
    tone(f, t + i * 0.22, 0.6, { type: 'triangle', peak: 0.1 }),
  );
}

/** Pack opening: a rising whoosh into a chime. */
export function playPackSound() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  whoosh(t, 0.7, 300, 4_000, 0.07);
  chord([ROOT * 2, ROOT * 2.5, ROOT * 3], t + 0.6, 0.8, 0.09);
}

/** A card flipping over. Pitch rises with rarity so a legendary reveal is audible. */
export function playRevealSound(rarity: Rarity) {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ROOT * 2 * RARITY_OCTAVE[rarity], t, 0.25, { type: 'triangle', peak: 0.1 });
}

export function haptic(pattern: number | number[]) {
  navigator.vibrate?.(pattern);
}
