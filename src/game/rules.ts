import { rarityOf, type Aircraft, type Rarity } from '../../shared/aircraft';
import { airlineFor } from '../lib/airline';
import { regionOf } from '../lib/regions';

export const XP_BY_RARITY: Record<Rarity, number> = { common: 10, rare: 25, epic: 60, legendary: 150 };
export const NEW_AIRLINE_XP = 15;
export const NEW_REGION_XP = 20;
export const ACHIEVEMENT_XP = 30;
export const QUEST_XP = 50;
export const ALERT_XP = 75;
export const FAST_KTS = 500;
export const SUPERSONIC_FAST_KTS = 550;

/** ICAO special-purpose squawk codes broadcast by real transponders. */
const SQUAWK_ALERTS: Record<string, string> = {
  '7700': 'Emergency',
  '7600': 'Radio failure',
  '7500': 'Hijack code',
};

export function squawkAlert(squawk: string | null): string | null {
  return squawk ? (SQUAWK_ALERTS[squawk] ?? null) : null;
}

export interface CatchRecord {
  hex: string;
  callsign: string;
  type: string | null;
  airline: string | null;
  region: string;
  rarity: Rarity;
  alt: number | null;
  night: boolean;
  at: number;
  // Added after v1 saves shipped; absent on older records, so treat missing as falsy
  speed?: number | null;
  ground?: boolean;
  rotor?: boolean;
  squawk?: string | null;
  mult?: number;
  reg?: string | null;
  track?: number;
  category?: string | null;
  /** 'catch' = you hunted it; 'pack' = pulled from the live sky into your wallet */
  source?: 'catch' | 'pack';
}

export interface Streak {
  days: number;
  lastDay: string | null;
}

// ---- Levels -------------------------------------------------------------

const TITLES = ['Spotter', 'Observer', 'Tracker', 'Hunter', 'Ace', 'Sky Legend'];

/** Cumulative XP needed to reach `level`. Quadratic: early levels arrive fast, later ones take longer. */
export function xpForLevel(level: number): number {
  return 40 * (level - 1) ** 2;
}

export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: TITLES[Math.min(Math.floor((level - 1) / 2), TITLES.length - 1)],
    progress: (xp - start) / (next - start),
    xpIntoLevel: xp - start,
    xpForNext: next - start,
  };
}

// ---- Combo --------------------------------------------------------------

export const COMBO_WINDOW_MS = 45_000;
export const MAX_MULTIPLIER = 5;

export interface Combo {
  chain: number;
  last: number;
  multiplier: number;
}

export const NO_COMBO: Combo = { chain: 0, last: 0, multiplier: 1 };

/** Catches inside the window extend the chain. The multiplier steps up every two catches, capped at x5. */
export function nextCombo(prev: Combo, at: number): Combo {
  const alive = prev.chain > 0 && at - prev.last <= COMBO_WINDOW_MS;
  const chain = alive ? prev.chain + 1 : 1;
  return { chain, last: at, multiplier: Math.min(MAX_MULTIPLIER, 1 + Math.floor((chain - 1) / 2)) };
}

// ---- Catches ------------------------------------------------------------

export function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 5;
}

export function recordFor(a: Aircraft, at: number, hour: number, mult = 1): CatchRecord {
  return {
    hex: a.hex,
    callsign: a.callsign,
    type: a.type,
    airline: airlineFor(a.callsign),
    region: regionOf(a.lat, a.lon),
    rarity: rarityOf(a.type, a.category),
    alt: a.alt,
    night: isNightHour(hour),
    at,
    speed: a.gs,
    ground: a.onGround,
    rotor: a.category === 'A7',
    squawk: a.squawk,
    mult,
    reg: a.reg,
    track: a.track,
    category: a.category,
    source: 'catch',
  };
}

export function xpForCatch(record: CatchRecord, isNewAirline: boolean, isNewRegion: boolean): number {
  const bonus = (isNewAirline ? NEW_AIRLINE_XP : 0) + (isNewRegion ? NEW_REGION_XP : 0);
  const alert = squawkAlert(record.squawk ?? null) ? ALERT_XP : 0;
  return XP_BY_RARITY[record.rarity] * (record.mult ?? 1) + alert + bonus;
}

export interface Stats {
  count: number;
  airlines: number;
  regions: number;
  rarity: Record<Rarity, number>;
  night: number;
  maxAlt: number;
  maxSpeed: number;
  ground: number;
  rotor: number;
  alerts: number;
  emergencies: number;
  maxMult: number;
}

export function statsOf(records: CatchRecord[]): Stats {
  const rarity: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const airlines = new Set<string>();
  const regions = new Set<string>();
  const s = { night: 0, maxAlt: 0, maxSpeed: 0, ground: 0, rotor: 0, alerts: 0, emergencies: 0, maxMult: 1 };
  for (const r of records) {
    rarity[r.rarity]++;
    if (r.airline) airlines.add(r.airline);
    regions.add(r.region);
    if (r.night) s.night++;
    if (r.ground) s.ground++;
    if (r.rotor) s.rotor++;
    if (squawkAlert(r.squawk ?? null)) s.alerts++;
    if (r.squawk === '7700') s.emergencies++;
    s.maxAlt = Math.max(s.maxAlt, r.alt ?? 0);
    s.maxSpeed = Math.max(s.maxSpeed, r.speed ?? 0);
    s.maxMult = Math.max(s.maxMult, r.mult ?? 1);
  }
  return { count: records.length, airlines: airlines.size, regions: regions.size, rarity, ...s };
}

// ---- Achievements -------------------------------------------------------

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  test: (s: Stats, latestStreak: number) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-catch', title: 'First Catch', description: 'Catch your first flight', test: (s) => s.count >= 1 },
  { id: 'widebody', title: 'Heavy Metal', description: 'Catch an epic widebody', test: (s) => s.rarity.epic + s.rarity.legendary >= 1 },
  { id: 'jumbo', title: 'Jumbo Spotter', description: 'Catch a legendary super-heavy', test: (s) => s.rarity.legendary >= 1 },
  { id: 'night-owl', title: 'Night Owl', description: 'Catch a flight between 10pm and 5am', test: (s) => s.night >= 1 },
  { id: 'high-flyer', title: 'High Flyer', description: 'Catch a flight above 40,000 ft', test: (s) => s.maxAlt >= 40_000 },
  { id: 'collector', title: 'Airline Collector', description: 'Catch 5 different airlines', test: (s) => s.airlines >= 5 },
  { id: 'globe-trotter', title: 'Globe Trotter', description: 'Catch flights on 3 continents', test: (s) => s.regions >= 3 },
  { id: 'on-a-roll', title: 'On a Roll', description: 'Keep a 3-day catching streak', test: (_, streak) => streak >= 3 },
  { id: 'centurion', title: 'Centurion', description: 'Catch 100 flights', test: (s) => s.count >= 100 },
  { id: 'sprinter', title: 'Sprinter', description: `Catch a flight doing ${SUPERSONIC_FAST_KTS} kt or more`, test: (s) => s.maxSpeed >= SUPERSONIC_FAST_KTS },
  { id: 'ground-control', title: 'Ground Control', description: 'Catch an aircraft sitting on the ground', test: (s) => s.ground >= 1 },
  { id: 'rotor-head', title: 'Rotor Head', description: 'Catch a helicopter', test: (s) => s.rotor >= 1 },
  { id: 'code-hunter', title: 'Code Hunter', description: 'Catch a special squawk (7500, 7600 or 7700)', test: (s) => s.alerts >= 1 },
  { id: 'mayday', title: 'Mayday Witness', description: 'Catch a squawk 7700 emergency', test: (s) => s.emergencies >= 1 },
  { id: 'on-fire', title: 'On Fire', description: 'Reach a x3 combo', test: (s) => s.maxMult >= 3 },
];

export function newlyUnlocked(unlockedIds: Set<string>, stats: Stats, streakDays: number): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id) && a.test(stats, streakDays));
}

// ---- Daily quests -------------------------------------------------------

export interface QuestDef {
  id: string;
  title: string;
  target: number;
  match: (r: CatchRecord) => boolean;
}

export const QUEST_POOL: QuestDef[] = [
  { id: 'catch-3', title: 'Catch 3 flights', target: 3, match: () => true },
  { id: 'widebody-1', title: 'Catch a widebody', target: 1, match: (r) => r.rarity === 'epic' || r.rarity === 'legendary' },
  { id: 'high-1', title: 'Catch a flight above 35,000 ft', target: 1, match: (r) => (r.alt ?? 0) >= 35_000 },
  { id: 'airlines-2', title: 'Catch 2 different airlines', target: 2, match: (r) => r.airline !== null },
  { id: 'rare-1', title: 'Catch a rare aircraft', target: 1, match: (r) => r.rarity !== 'common' },
  { id: 'night-1', title: 'Catch a night flight', target: 1, match: (r) => r.night },
  { id: 'fast-1', title: `Catch a flight over ${FAST_KTS} kt`, target: 1, match: (r) => (r.speed ?? 0) >= FAST_KTS },
  { id: 'rotor-1', title: 'Catch a helicopter', target: 1, match: (r) => !!r.rotor },
  { id: 'alert-1', title: 'Catch a squawk alert', target: 1, match: (r) => squawkAlert(r.squawk ?? null) !== null },
];

/** Three quests per local day, picked deterministically from the day key so every reload agrees. */
export function questsFor(day: string): QuestDef[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const picked: QuestDef[] = [];
  for (let i = 0; picked.length < 3; i++) {
    const q = QUEST_POOL[(h + i * 7) % QUEST_POOL.length];
    if (!picked.includes(q)) picked.push(q);
  }
  return picked;
}

export function dayKey(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nextStreak(streak: Streak, at: number): Streak {
  const day = dayKey(at);
  if (streak.lastDay === day) return streak;
  const d = new Date(at);
  const yesterday = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime());
  return { days: streak.lastDay === yesterday ? streak.days + 1 : 1, lastDay: day };
}
