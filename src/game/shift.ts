import type { Rarity } from '../../shared/aircraft';

/** A Sky Shift: a timed round with a goal. Win it and you get a pack; run out the clock and you lose the round. */
export const SHIFT_MS = 180_000;
export const SHIFT_WIN_XP = 60;
export const SHIFT_LOSS_XP = 10;

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export interface ShiftTier {
  name: string;
  catches: number;
  /** How many aircraft of at least `special` rarity the shift needs */
  count: number;
  special: Exclude<Rarity, 'common'>;
  /** The target in plain words, shown to the player: what to go and find */
  target: string;
}

/**
 * Each shift won moves you up a tier. Targets name a kind of aircraft, so a player knows what to look
 * for and can search for it. The top tier repeats.
 */
export const SHIFT_TIERS: ShiftTier[] = [
  { name: 'Trainee', catches: 5, count: 1, special: 'epic', target: 'a widebody airliner' },
  { name: 'Spotter', catches: 6, count: 2, special: 'epic', target: 'two widebody airliners' },
  { name: 'Observer', catches: 7, count: 1, special: 'rare', target: 'a business jet, helicopter or fighter-class aircraft' },
  { name: 'Ace', catches: 8, count: 2, special: 'rare', target: 'two business jets, helicopters or fighter-class aircraft' },
  { name: 'Legend', catches: 9, count: 1, special: 'legendary', target: 'a super-heavy: Airbus A380 or Boeing 747' },
];

export function tierFor(wins: number): ShiftTier {
  // wins = -1 can be asked for right after the first win; clamp so it resolves to the first tier
  return SHIFT_TIERS[Math.max(0, Math.min(wins, SHIFT_TIERS.length - 1))];
}

export type ShiftOutcome = 'active' | 'won' | 'lost';

export interface Shift {
  startedAt: number;
  tier: ShiftTier;
  catches: number;
  /** Catches that meet the tier's `special` rarity */
  special: number;
  escapes: number;
  outcome: ShiftOutcome;
}

export function startShift(at: number, wins = 0): Shift {
  return { startedAt: at, tier: tierFor(wins), catches: 0, special: 0, escapes: 0, outcome: 'active' };
}

/** A catch counts toward the goal. Meeting the goal wins the shift immediately. */
export function shiftAfterCatch(s: Shift, rarity: Rarity): Shift {
  if (s.outcome !== 'active') return s;
  const next = {
    ...s,
    catches: s.catches + 1,
    special: s.special + (RANK[rarity] >= RANK[s.tier.special] ? 1 : 0),
  };
  const met = next.catches >= s.tier.catches && next.special >= s.tier.count;
  return met ? { ...next, outcome: 'won' } : next;
}

/** An escaped bounty is a lesson, not a loss: it is counted but doesn't end the shift. */
export function shiftAfterEscape(s: Shift): Shift {
  return s.outcome === 'active' ? { ...s, escapes: s.escapes + 1 } : s;
}

/** Ends the shift as lost when the clock runs out before the goal. */
export function shiftTick(s: Shift, at: number): Shift {
  if (s.outcome !== 'active') return s;
  return at - s.startedAt >= SHIFT_MS ? { ...s, outcome: 'lost' } : s;
}

export function shiftRemainingMs(s: Shift, at: number): number {
  return Math.max(0, SHIFT_MS - (at - s.startedAt));
}

export function describeGoal(t: ShiftTier): string {
  return `Catch ${t.catches} aircraft in 3 minutes, including ${t.target}`;
}

/** Plain-language reason a lost shift was lost, so the loss teaches something. */
export function lossLesson(s: Shift): string {
  if (s.special === 0) return `No ${s.tier.target} in time. Search for the type, or try a busier region.`;
  if (s.catches < s.tier.catches) return 'Too few catches. Hold on a plane to catch it, and keep your combo going.';
  return 'Close, but not enough. Watch for bounties before they leave view.';
}
