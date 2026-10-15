export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** One aircraft as served by /api/aircraft. `age` is ms since its last position fix, measured at response time. */
export interface Aircraft {
  hex: string;
  callsign: string;
  reg: string | null;
  type: string | null;
  category: string | null;
  lat: number;
  lon: number;
  track: number;
  gs: number | null;
  alt: number | null;
  onGround: boolean;
  squawk: string | null;
  age: number;
}

/** Shape of one aircraft in an adsb.lol v2 response. Only the fields we read. */
export interface RawAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  category?: string;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  true_heading?: number;
  lat?: number;
  lon?: number;
  squawk?: string;
  seen_pos?: number;
}

export function normalizeAircraft(raw: RawAircraft, fixAgeMs: number): Aircraft | null {
  if (typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return null;
  return {
    hex: raw.hex.toLowerCase(),
    callsign: raw.flight?.trim() || raw.hex.toUpperCase(),
    reg: raw.r || null,
    type: raw.t || null,
    category: raw.category || null,
    lat: raw.lat,
    lon: raw.lon,
    track: raw.track ?? raw.true_heading ?? 0,
    gs: raw.gs ?? null,
    alt: typeof raw.alt_baro === 'number' ? raw.alt_baro : null,
    onGround: raw.alt_baro === 'ground',
    squawk: raw.squawk ?? null,
    age: (raw.seen_pos ?? 0) * 1000 + fixAgeMs,
  };
}

const LEGENDARY_TYPES = new Set(['A388', 'B744', 'B748', 'A124', 'A225']);
const WIDEBODY = /^(B74|B76|B77|B78|A30|A33|A34|A35)/;
const BUSINESS_JET = /^(GLF|CL3|CL6|LJ|C5|C6|F9|FA|E50|E55|PC12)/;

/** Rarity is a game mechanic, not a data judgement: rarer = bigger XP. */
export function rarityOf(type: string | null, category: string | null): Rarity {
  if (type && LEGENDARY_TYPES.has(type)) return 'legendary';
  if (type && WIDEBODY.test(type)) return 'epic';
  if (category === 'A6' || category === 'A7' || (type && BUSINESS_JET.test(type))) return 'rare';
  return 'common';
}
