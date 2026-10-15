import type { Rarity } from '../../shared/aircraft';
import { airframeFor, CATEGORY_LABEL, type Airframe } from '../data/airframes';
import { squawkAlert, type CatchRecord } from './rules';

export interface CardStats {
  /** 0–100, where 100 is 600 kt or faster */
  speed: number;
  /** 0–100, where 100 is 45,000 ft or higher */
  altitude: number;
  /** 0–100, from rarity */
  rarity: number;
}

export interface Card {
  id: string;
  hex: string;
  callsign: string;
  reg: string | null;
  typeCode: string | null;
  airframe: Airframe | null;
  categoryLabel: string | null;
  airline: string | null;
  region: string;
  rarity: Rarity;
  foil: boolean;
  stats: CardStats;
  /** Facts computed from this flight's own data. Plain sentences, no figures we can't back up. */
  facts: string[];
  caughtAt: number;
  source: 'catch' | 'pack';
}

const RARITY_STAT: Record<Rarity, number> = { common: 20, rare: 50, epic: 80, legendary: 100 };
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const KMH_PER_KT = 1.852;
const FOIL_ONE_IN = 10;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Deterministic, so a plane is always foil or never foil, and reloading can't re-roll it. */
export function isFoil(hex: string): boolean {
  let h = 0;
  for (const ch of hex) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % FOIL_ONE_IN === 0;
}

export function compassPoint(deg: number): string {
  const normalised = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalised / 22.5) % 16];
}

export function factsFor(r: CatchRecord, airframe: Airframe | null): string[] {
  const facts: string[] = [];
  if (r.ground) {
    facts.push('On the ground: parked, taxiing, or on a runway.');
  } else if (r.alt !== null && r.alt !== undefined) {
    const fl = Math.round(r.alt / 100);
    if (r.alt >= 30_000) {
      facts.push(`Cruising at FL${fl}. Typical airliner cruise is around 30,000–41,000 ft.`);
    } else if (r.alt < 10_000) {
      facts.push(`Below 10,000 ft, so it is in the terminal area. Speed is usually limited to 250 kt there.`);
    } else {
      facts.push(`Climbing or descending through FL${fl}, which most airliners pass on the way up or down.`);
    }
  }

  if (r.speed) {
    facts.push(`Ground speed ${Math.round(r.speed)} kt, about ${Math.round(r.speed * KMH_PER_KT)} km/h.`);
    if (r.speed >= 500) facts.push('Above 500 kt usually means a strong tailwind or a very fast type.');
  }

  if (r.track !== undefined) {
    facts.push(`Heading ${Math.round(r.track)}° (${compassPoint(r.track)}).`);
  }

  const alert = squawkAlert(r.squawk ?? null);
  if (alert) {
    facts.push(`Squawk ${r.squawk}: ${alert}.`);
  } else if (r.squawk === '1200') {
    facts.push('Squawk 1200 is the standard code for flying by visual rules.');
  }

  if (r.category && CATEGORY_LABEL[r.category]) facts.push(`Size class: ${CATEGORY_LABEL[r.category]}.`);
  if (r.rotor) facts.push('Helicopters can hover and fly slowly. This one is a rotorcraft.');
  facts.push(airframe ? airframe.fact : `Type code ${r.type ?? 'unknown'} is not in our reference yet.`);
  return facts;
}

export function buildCard(r: CatchRecord): Card {
  const airframe = airframeFor(r.type);
  return {
    id: `${r.hex}-${r.at}`,
    hex: r.hex,
    callsign: r.callsign,
    reg: r.reg ?? null,
    typeCode: r.type,
    airframe,
    categoryLabel: r.category ? (CATEGORY_LABEL[r.category] ?? null) : null,
    airline: r.airline,
    region: r.region,
    rarity: r.rarity,
    foil: isFoil(r.hex),
    stats: {
      speed: clamp((r.speed ?? 0) / 6),
      altitude: clamp((r.alt ?? 0) / 450),
      rarity: RARITY_STAT[r.rarity],
    },
    facts: factsFor(r, airframe),
    caughtAt: r.at,
    source: r.source ?? 'catch',
  };
}
