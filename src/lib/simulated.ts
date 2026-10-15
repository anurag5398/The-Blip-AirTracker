import { CLUSTER_CENTER, type Cluster } from '../../shared/coverage';
import type { Blip } from './flights';

/**
 * Placeholder traffic for regions whose live data isn't verified yet. Deterministic, so the same region
 * always looks the same. Every callsign is marked SIM-, so nobody mistakes it for a real flight.
 */
const PER_CLUSTER = 70;

const TYPES: { type: string; category: string; weight: number }[] = [
  { type: 'A320', category: 'A3', weight: 14 },
  { type: 'B738', category: 'A3', weight: 14 },
  { type: 'A321', category: 'A3', weight: 8 },
  { type: 'E190', category: 'A3', weight: 4 },
  { type: 'AT76', category: 'A3', weight: 2 },
  { type: 'B789', category: 'A5', weight: 3 },
  { type: 'A359', category: 'A5', weight: 3 },
  { type: 'B77W', category: 'A5', weight: 1 },
  { type: 'A388', category: 'A5', weight: 0.3 },
  { type: 'GLF6', category: 'A2', weight: 0.6 },
];

/** Small, seeded PRNG (mulberry32): same seed, same sky. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickType(r: number) {
  const total = TYPES.reduce((a, t) => a + t.weight, 0);
  let roll = r * total;
  for (const t of TYPES) {
    if (roll < t.weight) return t;
    roll -= t.weight;
  }
  return TYPES[0];
}

export function simulatedSky(dark: Cluster[], now: number): Blip[] {
  const out: Blip[] = [];
  dark.forEach((cluster, ci) => {
    const r = rng(1000 + ci);
    const [lon0, lat0] = CLUSTER_CENTER[cluster];
    for (let i = 0; i < PER_CLUSTER; i++) {
      const t = pickType(r());
      const lat = lat0 + (r() - 0.5) * 16;
      const lon = lon0 + (r() - 0.5) * 24;
      const callsign = `SIM-${String(ci * 1000 + i).padStart(4, '0')}`;
      out.push({
        hex: `sim${ci}${i}`,
        callsign,
        reg: null,
        type: t.type,
        category: t.category,
        lat,
        lon,
        track: Math.round(r() * 359),
        gs: Math.round(260 + r() * 240),
        alt: Math.round(20_000 + r() * 16_000),
        onGround: false,
        squawk: '1200',
        age: 0,
        fixAt: now,
        simulated: true,
      });
    }
  });
  return out;
}
