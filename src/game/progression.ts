import { airframeFor } from '../data/airframes';
import { squawkAlert, type CatchRecord } from './rules';

export const WEEKLY_XP = 150;
export const SET_XP = 150;

// ---- Weekly goals -------------------------------------------------------

/** Weeks start on Monday. The key is that Monday's local date, so it sorts and compares as a string. */
export function weekKey(at: number): string {
  const d = new Date(at);
  const sinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

export interface WeekStats {
  catches: number;
  epicPlus: number;
  shiftWins: number;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  target: number;
  measure: (w: WeekStats) => number;
}

export const WEEKLY_GOALS: WeeklyGoal[] = [
  { id: 'catch-40', title: 'Catch 40 aircraft', target: 40, measure: (w) => w.catches },
  { id: 'epic-5', title: 'Catch 5 epic or legendary aircraft', target: 5, measure: (w) => w.epicPlus },
  { id: 'shifts-2', title: 'Win 2 Sky Shifts', target: 2, measure: (w) => w.shiftWins },
];

/** Stats for the week that contains `at`. Shift wins are stored per week key by the store. */
export function weekStats(records: CatchRecord[], shiftWinsByWeek: Record<string, number>, at: number): WeekStats {
  const key = weekKey(at);
  let catches = 0;
  let epicPlus = 0;
  for (const r of records) {
    if (weekKey(r.at) !== key) continue;
    catches++;
    if (r.rarity === 'epic' || r.rarity === 'legendary') epicPlus++;
  }
  return { catches, epicPlus, shiftWins: shiftWinsByWeek[key] ?? 0 };
}

export function weeklyGoalsFor(w: WeekStats) {
  return WEEKLY_GOALS.map((g) => {
    const progress = Math.min(g.measure(w), g.target);
    return { goal: g, progress, done: progress >= g.target };
  });
}

/** Ids of weekly goals that are complete now but weren't before. Each pays out exactly once. */
export function newlyCompleteWeekly(before: WeekStats, after: WeekStats): WeeklyGoal[] {
  return WEEKLY_GOALS.filter((g) => g.measure(before) < g.target && g.measure(after) >= g.target);
}

// ---- Card sets ----------------------------------------------------------

export interface CardSet {
  id: string;
  title: string;
  blurb: string;
  /** How many distinct members make the set complete */
  need: number;
  belongs: (r: CatchRecord) => boolean;
  /** What counts as one distinct member: a type code, or a single helicopter by hex */
  keyOf: (r: CatchRecord) => string;
}

const JUMBOS = new Set(['A388', 'B744', 'B748']);

export const CARD_SETS: CardSet[] = [
  {
    id: 'widebody',
    title: 'Widebody Club',
    blurb: 'Four different widebody types',
    need: 4,
    belongs: (r) => airframeFor(r.type)?.kind === 'widebody',
    keyOf: (r) => r.type ?? '',
  },
  {
    id: 'jumbo',
    title: 'Jumbo Dynasty',
    blurb: 'Two of the three super-heavies',
    need: 2,
    belongs: (r) => JUMBOS.has(r.type ?? ''),
    keyOf: (r) => r.type ?? '',
  },
  {
    id: 'business',
    title: 'Business Class',
    blurb: 'Two different business jets',
    need: 2,
    belongs: (r) => airframeFor(r.type)?.kind === 'bizjet',
    keyOf: (r) => r.type ?? '',
  },
  {
    id: 'narrowbody',
    title: 'Narrowbody Era',
    blurb: 'Five different narrowbody types',
    need: 5,
    belongs: (r) => airframeFor(r.type)?.kind === 'narrowbody',
    keyOf: (r) => r.type ?? '',
  },
  {
    id: 'regional',
    title: 'Regional Wings',
    blurb: 'Three regional jets or turboprops',
    need: 3,
    belongs: (r) => {
      const kind = airframeFor(r.type)?.kind;
      return kind === 'regional' || kind === 'turboprop';
    },
    keyOf: (r) => r.type ?? '',
  },
  {
    id: 'rotor',
    title: 'Rotor Club',
    blurb: 'Three different helicopters',
    need: 3,
    belongs: (r) => r.rotor === true,
    keyOf: (r) => r.hex,
  },
  {
    id: 'code-hunter',
    title: 'Code Hunter',
    blurb: 'Two different special squawk codes',
    need: 2,
    belongs: (r) => squawkAlert(r.squawk ?? null) !== null,
    keyOf: (r) => r.squawk ?? '',
  },
];

export function setProgress(set: CardSet, records: CatchRecord[]): { owned: number; need: number; complete: boolean } {
  const keys = new Set<string>();
  for (const r of records) if (set.belongs(r)) keys.add(set.keyOf(r));
  const owned = Math.min(keys.size, set.need);
  return { owned, need: set.need, complete: keys.size >= set.need };
}

/** Sets that became complete with this catch, excluding those already paid out. */
export function newlyCompleteSets(before: CatchRecord[], after: CatchRecord[], claimed: string[]): CardSet[] {
  return CARD_SETS.filter(
    (s) => !claimed.includes(s.id) && !setProgress(s, before).complete && setProgress(s, after).complete,
  );
}
