import { describe, expect, it } from 'vitest';
import type { Aircraft } from '../../shared/aircraft';
import { COMBO_WINDOW_MS, NO_COMBO, levelFor, nextCombo, questsFor, dayKey, nextStreak, recordFor, squawkAlert, xpForLevel } from './rules';
import { reduceCatch, todayQuests, type GameState } from './store';
import { buildCard, compassPoint, isFoil } from './cards';
import { ESCAPE_GRACE_MS, updateBounties } from './bounties';
import { SHIFT_MS, SHIFT_TIERS, shiftAfterCatch, shiftAfterEscape, shiftTick, startShift, tierFor } from './shift';
import { pullPack } from './packs';
import { MISSION_MS, PTS_CORRECT, PTS_GOAL_BONUS, PTS_WRONG, isOver, missionStep, startMission } from './mission';
import { CARD_SETS, newlyCompleteSets, setProgress, weekKey, weekStats } from './progression';

const EMPTY: GameState = {
  records: [],
  xp: 0,
  achievements: {},
  streak: { days: 0, lastDay: null },
  quests: { day: '', progress: {}, done: [] },
  tutorialDone: false,
  soundOn: true,
  shift: null,
  shiftLog: { won: 0, lost: 0 },
  shiftWinsByWeek: {},
  setsClaimed: [],
  packs: 0,
  escapes: 0,
};

const at = new Date(2026, 5, 10, 14, 0).getTime();
const plane = (over: Partial<Aircraft> = {}): Aircraft => ({
  hex: 'abc123',
  callsign: 'BAW117',
  reg: null,
  type: 'A320',
  category: 'A3',
  lat: 51.5,
  lon: -0.5,
  track: 90,
  gs: 420,
  alt: 34_000,
  onGround: false,
  squawk: null,
  age: 0,
  ...over,
});

describe('reduceCatch', () => {
  it('logs a catch once and ignores repeats of the same aircraft', () => {
    const first = reduceCatch(EMPTY, plane(), at, 14)!;
    expect(first.outcome.record.airline).toBe('British Airways');
    expect(reduceCatch(first.state, plane(), at, 14)).toBeNull();
  });

  it('awards rarity XP plus new-airline and new-region bonuses', () => {
    const { outcome } = reduceCatch(EMPTY, plane({ type: 'B789', category: 'A5' }), at, 14)!;
    expect(outcome.record.rarity).toBe('epic');
    // Strip achievement and quest bonuses so the assertion doesn't depend on the day's quests
    const base = outcome.xpGained - outcome.achievements.length * 30 - outcome.quests.length * 50;
    expect(base).toBe(60 + 15 + 20);
  });

  it('reports a level-up when XP crosses the next threshold', () => {
    const near = { ...EMPTY, xp: xpForLevel(2) - 5 };
    const { outcome, state } = reduceCatch(near, plane(), at, 14)!;
    expect(outcome.levelUp).toBe(2);
    expect(levelFor(state.xp).level).toBe(2);
  });

  it('completes single-target daily quests that match the catch', () => {
    const day = dayKey(at);
    const result = reduceCatch(EMPTY, plane(), at, 14)!;
    const expected = questsFor(day)
      .filter((q) => q.target === 1 && q.match(result.outcome.record))
      .map((q) => q.id);

    expect(result.outcome.quests.map((q) => q.id)).toEqual(expected);
    expect(result.state.quests.done).toEqual(expected);
    expect(todayQuests(result.state, at)).toHaveLength(3);
  });

  it('starts a streak on the first catch and extends it on the next day', () => {
    const day1 = reduceCatch(EMPTY, plane(), at, 14)!.state;
    const nextDay = at + 86_400_000;
    expect(nextStreak(day1.streak, nextDay).days).toBe(2);
    expect(nextStreak(day1.streak, at + 3 * 86_400_000).days).toBe(1);
  });

  it('scales base XP by the combo multiplier and adds the squawk-alert bonus', () => {
    const { outcome } = reduceCatch(EMPTY, plane({ hex: 'x1', squawk: '7700' }), at, 14, 3)!;
    expect(outcome.record.mult).toBe(3);
    // common 10 x3 + alert 75 + new airline 15 + new region 20; achievement/quest bonuses removed
    const base = outcome.xpGained - outcome.achievements.length * 30 - outcome.quests.length * 50;
    expect(base).toBe(10 * 3 + 75 + 15 + 20);
  });

  it('unlocks the speed, ground and emergency achievements from plane data', () => {
    const fast = reduceCatch(EMPTY, plane({ hex: 'f', gs: 560 }), at, 14)!.outcome;
    expect(fast.achievements.map((a) => a.id)).toContain('sprinter');

    const grounded = reduceCatch(EMPTY, plane({ hex: 'g', onGround: true, alt: null }), at, 14)!.outcome;
    expect(grounded.achievements.map((a) => a.id)).toContain('ground-control');

    const mayday = reduceCatch(EMPTY, plane({ hex: 'm', squawk: '7700' }), at, 14)!.outcome;
    expect(mayday.achievements.map((a) => a.id)).toEqual(expect.arrayContaining(['mayday', 'code-hunter']));
  });
});

describe('combo and squawk rules', () => {
  it('steps the multiplier up every two catches and resets after the window', () => {
    let c = NO_COMBO;
    const mults: number[] = [];
    for (let i = 0; i < 6; i++) {
      c = nextCombo(c, at + i * 1_000);
      mults.push(c.multiplier);
    }
    expect(mults).toEqual([1, 1, 2, 2, 3, 3]);
    expect(nextCombo(c, at + 5_000 + COMBO_WINDOW_MS + 1).chain).toBe(1);
  });

  it('recognises the three ICAO special-purpose squawks only', () => {
    expect(squawkAlert('7700')).toBe('Emergency');
    expect(squawkAlert('7600')).toBe('Radio failure');
    expect(squawkAlert('7500')).toBe('Hijack code');
    expect(squawkAlert('1200')).toBeNull();
    expect(squawkAlert(null)).toBeNull();
  });
});

describe('cards', () => {
  it('derives foil deterministically from the hex', () => {
    expect(isFoil('abc123')).toBe(isFoil('abc123'));
  });

  it('turns headings into compass points and explains emergency squawks', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(359)).toBe('N');
    const card = buildCard(recordFor(plane({ hex: 'e1', squawk: '7700', gs: 300 }), at, 14));
    expect(card.facts.join(' ')).toContain('Squawk 7700: Emergency');
  });
});

describe('bounties', () => {
  const sighting = (hex: string, type: string, category = 'A3') => ({ hex, callsign: hex.toUpperCase(), type, category });

  it('spots rare-or-better aircraft only', () => {
    const { spotted } = updateBounties([], [sighting('a', 'A320'), sighting('b', 'A388', 'A5')], new Set(), 0);
    expect(spotted.map((b) => b.hex)).toEqual(['b']);
  });

  it('escapes only after the grace period out of view, not on a brief pan', () => {
    const start = updateBounties([], [sighting('b', 'A388', 'A5')], new Set(), 0);
    const briefGap = updateBounties(start.active, [], new Set(), ESCAPE_GRACE_MS - 1);
    expect(briefGap.escaped).toHaveLength(0);
    const longGap = updateBounties(briefGap.active, [], new Set(), ESCAPE_GRACE_MS + 1);
    expect(longGap.escaped.map((b) => b.hex)).toEqual(['b']);
  });

  it('drops a bounty once it is caught', () => {
    const start = updateBounties([], [sighting('b', 'A388', 'A5')], new Set(), 0);
    const after = updateBounties(start.active, [], new Set(['b']), 1_000);
    expect(after.active).toHaveLength(0);
    expect(after.escaped).toHaveLength(0);
  });
});

describe('sky shifts', () => {
  it('wins on the goal (5 catches including one rare) and pays a pack', () => {
    let s = startShift(0);
    for (let i = 0; i < 4; i++) s = shiftAfterCatch(s, 'common');
    expect(s.outcome).toBe('active');
    s = shiftAfterCatch(s, 'epic');
    expect(s.outcome).toBe('won');
  });

  it('loses when the clock runs out first', () => {
    const s = shiftTick(startShift(0), SHIFT_MS);
    expect(s.outcome).toBe('lost');
  });

  it('counts escapes without ending the shift', () => {
    const s = shiftAfterEscape(startShift(0));
    expect(s.outcome).toBe('active');
    expect(s.escapes).toBe(1);
  });

  it('a catch that wins the shift pays a pack and reports the win', () => {
    const won: GameState = {
      ...EMPTY,
      shift: { startedAt: at, tier: SHIFT_TIERS[0], catches: 4, special: 1, escapes: 0, outcome: 'active' },
    };
    const result = reduceCatch(won, plane({ hex: 'w', gs: 300 }), at, 14)!;
    expect(result.outcome.shiftResult).toBe('won');
    expect(result.state.packs).toBe(1);
    expect(result.state.shiftLog.won).toBe(1);
  });
});

describe('packs', () => {
  const pool = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ hex: `p${i}`, type: i === 0 ? 'A388' : 'A320', category: i === 0 ? 'A5' : 'A3' }));

  it('pulls three distinct aircraft, or fewer if the sky is quiet', () => {
    const pulled = pullPack(pool(10), () => 0.5);
    expect(new Set(pulled.map((p) => p.hex)).size).toBe(3);
    expect(pullPack(pool(2), () => 0.5)).toHaveLength(2);
  });

  it('takes the first candidate on a zero roll', () => {
    expect(pullPack(pool(10), () => 0)[0].hex).toBe('p0');
  });
});

describe('progression', () => {
  it('starts weeks on Monday, so a Sunday belongs to the week before', () => {
    const monday = new Date(2026, 5, 8, 12).getTime(); // a Monday
    const sunday = new Date(2026, 5, 14, 12).getTime();
    expect(weekKey(monday)).toBe('2026-06-08');
    expect(weekKey(sunday)).toBe('2026-06-08');
    expect(weekKey(new Date(2026, 5, 15, 12).getTime())).toBe('2026-06-15');
  });

  it('counts this week’s catches and epic+ aircraft for weekly goals', () => {
    const stats = weekStats(
      [
        { ...recordFor(plane({ hex: 'a' }), monday(), 12), rarity: 'epic' },
        recordFor(plane({ hex: 'b' }), monday(), 12),
      ],
      { [weekKey(monday())]: 1 },
      monday(),
    );
    expect(stats).toEqual({ catches: 2, epicPlus: 1, shiftWins: 1 });
  });

  it('completes a card set once enough distinct members are owned', () => {
    const widebody = CARD_SETS.find((s) => s.id === 'widebody')!;
    const types = ['B789', 'B772', 'A359', 'A333'];
    const records = types.map((t, i) => recordFor(plane({ hex: `w${i}`, type: t, category: 'A5' }), at, 14));
    expect(setProgress(widebody, records.slice(0, 3)).complete).toBe(false);
    expect(setProgress(widebody, records).complete).toBe(true);
    expect(newlyCompleteSets(records.slice(0, 3), records, []).map((s) => s.id)).toContain('widebody');
    expect(newlyCompleteSets(records, records, []).map((s) => s.id)).not.toContain('widebody');
  });

  it('gives the next shift a higher tier after each win', () => {
    expect(tierFor(0).name).toBe('Trainee');
    expect(tierFor(2).name).toBe('Observer');
    expect(tierFor(99).name).toBe('Legend');
    expect(startShift(0, 1).tier.name).toBe('Spotter');
  });
});

describe('two-minute mission', () => {
  const widebody = (hex: string) => ({ hex, type: 'B789', category: 'A5', alt: 35000, squawk: null });
  const light = (hex: string) => ({ hex, type: 'A320', category: 'A3', alt: 30000, squawk: null });
  const t0 = 1_000_000;
  // Seed 0 starts with the widebody goal
  const fresh = () => startMission(t0, 0);

  it('scores a correct log, builds a streak, and ignores a second tap on the same contact', () => {
    let s = missionStep(fresh(), { type: 'log', contact: widebody('a') }, t0 + 1000);
    expect(s.score).toBe(PTS_CORRECT);
    expect(s.streak).toBe(1);
    s = missionStep(s, { type: 'log', contact: widebody('a') }, t0 + 2000);
    expect(s.correct).toBe(1);
  });

  it('penalises a wrong log and breaks the streak', () => {
    let s = missionStep(fresh(), { type: 'log', contact: widebody('a') }, t0 + 1000);
    s = missionStep(s, { type: 'log', contact: light('b') }, t0 + 2000);
    expect(s.streak).toBe(0);
    expect(s.wrong).toBe(1);
    expect(s.score).toBe(PTS_CORRECT + PTS_WRONG);
  });

  it('pays a bonus and rolls to the next goal when one is completed', () => {
    let s = fresh();
    for (let i = 0; i < 5; i++) s = missionStep(s, { type: 'log', contact: widebody(`w${i}`) }, t0 + 1000 + i);
    expect(s.goalsCompleted).toBe(1);
    expect(s.goalIndex).toBe(1);
    expect(s.progress).toBe(0);
    expect(s.score).toBeGreaterThanOrEqual(PTS_GOAL_BONUS);
  });

  it('ignores every action once the two minutes are up', () => {
    const s = fresh();
    expect(isOver(s, t0 + MISSION_MS)).toBe(true);
    expect(missionStep(s, { type: 'log', contact: widebody('late') }, t0 + MISSION_MS)).toBe(s);
  });
});

function monday() {
  return new Date(2026, 5, 8, 12).getTime();
}
