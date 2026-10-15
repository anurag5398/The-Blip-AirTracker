import { useSyncExternalStore } from 'react';
import type { Aircraft } from '../../shared/aircraft';
import {
  ACHIEVEMENT_XP,
  dayKey,
  levelFor,
  newlyUnlocked,
  nextStreak,
  QUEST_XP,
  questsFor,
  recordFor,
  statsOf,
  xpForCatch,
  type AchievementDef,
  type CatchRecord,
  type QuestDef,
  type Streak,
} from './rules';
import {
  SHIFT_LOSS_XP,
  SHIFT_WIN_XP,
  lossLesson,
  shiftAfterCatch,
  shiftAfterEscape,
  shiftTick,
  startShift,
  type Shift,
} from './shift';
import {
  newlyCompleteSets,
  newlyCompleteWeekly,
  SET_XP,
  weekKey,
  weekStats,
  WEEKLY_XP,
  type CardSet,
  type WeeklyGoal,
} from './progression';

export interface GameState {
  records: CatchRecord[];
  xp: number;
  achievements: Record<string, number>;
  streak: Streak;
  quests: { day: string; progress: Record<string, number>; done: string[] };
  tutorialDone: boolean;
  soundOn: boolean;
  /** The active Sky Shift, or null when none is running */
  shift: Shift | null;
  /** Shift results across all time. Wins also set the next shift's tier. */
  shiftLog: { won: number; lost: number };
  /** Shift wins per ISO week key, for weekly goals */
  shiftWinsByWeek: Record<string, number>;
  /** Card sets already paid out, by set id */
  setsClaimed: string[];
  /** Unopened packs earned from winning shifts */
  packs: number;
  escapes: number;
}

export interface CatchOutcome {
  record: CatchRecord;
  xpGained: number;
  levelUp: number | null;
  achievements: AchievementDef[];
  quests: QuestDef[];
  weekly: WeeklyGoal[];
  sets: CardSet[];
  multiplier: number;
  shiftResult: 'won' | 'lost' | null;
}

const STORAGE_KEY = 'blip:v1';

const EMPTY: GameState = {
  records: [],
  xp: 0,
  achievements: {},
  streak: { days: 0, lastDay: null },
  quests: { day: '', progress: {}, done: [] },
  tutorialDone: false,
  soundOn: false,
  shift: null,
  shiftLog: { won: 0, lost: 0 },
  shiftWinsByWeek: {},
  setsClaimed: [],
  packs: 0,
  escapes: 0,
};

/** Pure: returns the next state and what the catch earned, or null if this aircraft is already logged. */
export function reduceCatch(
  state: GameState,
  aircraft: Aircraft,
  at: number,
  hour: number,
  multiplier = 1,
): { state: GameState; outcome: CatchOutcome } | null {
  if (state.records.some((r) => r.hex === aircraft.hex)) return null;

  const record = recordFor(aircraft, at, hour, multiplier);
  const airlines = new Set(state.records.map((r) => r.airline));
  const regions = new Set(state.records.map((r) => r.region));
  const baseXp = xpForCatch(
    record,
    record.airline !== null && !airlines.has(record.airline),
    !regions.has(record.region),
  );

  const records = [...state.records, record];
  const streak = nextStreak(state.streak, at);

  const day = dayKey(at);
  const questState = state.quests.day === day ? state.quests : { day, progress: {}, done: [] };
  const progress = { ...questState.progress };
  const done = [...questState.done];
  const questsDone: QuestDef[] = [];
  for (const q of questsFor(day)) {
    if (done.includes(q.id) || !q.match(record)) continue;
    progress[q.id] = (progress[q.id] ?? 0) + 1;
    if (progress[q.id] >= q.target) {
      done.push(q.id);
      questsDone.push(q);
    }
  }

  const unlocked = newlyUnlocked(new Set(Object.keys(state.achievements)), statsOf(records), streak.days);
  const achievements = { ...state.achievements };
  for (const a of unlocked) achievements[a.id] = at;

  // The shift can end on this catch: a win pays a pack, bonus XP, and counts toward the weekly goals
  const shift = state.shift ? shiftAfterCatch(state.shift, record.rarity) : null;
  const won = shift?.outcome === 'won' && state.shift?.outcome === 'active';
  const shiftWinsByWeek = won
    ? { ...state.shiftWinsByWeek, [weekKey(at)]: (state.shiftWinsByWeek[weekKey(at)] ?? 0) + 1 }
    : state.shiftWinsByWeek;

  const weeklyBefore = weekStats(state.records, state.shiftWinsByWeek, at);
  const weeklyAfter = weekStats(records, shiftWinsByWeek, at);
  const weekly = newlyCompleteWeekly(weeklyBefore, weeklyAfter);
  const sets = newlyCompleteSets(state.records, records, state.setsClaimed);

  const xpGained =
    baseXp +
    questsDone.length * QUEST_XP +
    unlocked.length * ACHIEVEMENT_XP +
    (won ? SHIFT_WIN_XP : 0) +
    weekly.length * WEEKLY_XP +
    sets.length * SET_XP;
  const xp = state.xp + xpGained;
  const levelBefore = levelFor(state.xp).level;
  const levelAfter = levelFor(xp).level;

  return {
    state: {
      ...state,
      records,
      xp,
      achievements,
      streak,
      quests: { day, progress, done },
      shift,
      packs: state.packs + (won ? 1 : 0),
      shiftLog: won ? { ...state.shiftLog, won: state.shiftLog.won + 1 } : state.shiftLog,
      shiftWinsByWeek,
      setsClaimed: [...state.setsClaimed, ...sets.map((s) => s.id)],
    },
    outcome: {
      record,
      xpGained,
      levelUp: levelAfter > levelBefore ? levelAfter : null,
      achievements: unlocked,
      quests: questsDone,
      weekly,
      sets,
      multiplier,
      shiftResult: won ? 'won' : null,
    },
  };
}

/** Today's quests with progress, derived from state (a stale day counts as zero progress). */
export function todayQuests(state: GameState, at: number) {
  const day = dayKey(at);
  const current: { progress: Record<string, number>; done: string[] } =
    state.quests.day === day ? state.quests : { progress: {}, done: [] };
  return questsFor(day).map((def) => ({
    def,
    progress: Math.min(current.progress[def.id] ?? 0, def.target),
    done: current.done.includes(def.id),
  }));
}

/** Ends an expired shift as lost, paying consolation XP. Returns the same state if nothing changed. */
export function settleShiftState(state: GameState, at: number): GameState {
  if (!state.shift) return state;
  const next = shiftTick(state.shift, at);
  if (next.outcome !== 'lost') return next === state.shift ? state : { ...state, shift: next };
  return {
    ...state,
    shift: next,
    xp: state.xp + SHIFT_LOSS_XP,
    shiftLog: { ...state.shiftLog, lost: state.shiftLog.lost + 1 },
  };
}

function load(): GameState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<GameState> | null;
    if (parsed && Array.isArray(parsed.records) && typeof parsed.xp === 'number') {
      return { ...EMPTY, ...parsed } as GameState;
    }
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return EMPTY;
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: GameState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode or quota: the game still works for this session
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

export function getGame(): GameState {
  return state;
}

export function isCaught(hex: string): boolean {
  return state.records.some((r) => r.hex === hex);
}

export function catchAircraft(aircraft: Aircraft, at = Date.now(), multiplier = 1): CatchOutcome | null {
  const result = reduceCatch(state, aircraft, at, new Date(at).getHours(), multiplier);
  if (!result) return null;
  commit(result.state);
  return result.outcome;
}

/** Puts pulled cards into the wallet. Pack cards add to the collection; they can complete sets, which pay out. */
export function addPackCards(aircraft: CatchRecord[]) {
  const have = new Set(state.records.map((r) => r.hex));
  const fresh = aircraft.filter((r) => !have.has(r.hex));
  const records = [...state.records, ...fresh];
  const sets = newlyCompleteSets(state.records, records, state.setsClaimed);
  commit({
    ...state,
    records,
    xp: state.xp + sets.length * SET_XP,
    setsClaimed: [...state.setsClaimed, ...sets.map((s) => s.id)],
    packs: Math.max(0, state.packs - 1),
  });
  return sets;
}

export function startSkyShift(at = Date.now()) {
  if (state.shift?.outcome === 'active') return;
  commit({ ...state, shift: startShift(at, state.shiftLog.won) });
}

export function recordEscape() {
  commit({
    ...state,
    escapes: state.escapes + 1,
    shift: state.shift ? shiftAfterEscape(state.shift) : null,
  });
}

/** Settles the shift clock. Call on a timer. Returns the lesson when a shift is just lost. */
export function settleShift(at = Date.now()): string | null {
  const before = state.shift;
  const next = settleShiftState(state, at);
  if (next !== state) commit(next);
  return before?.outcome === 'active' && next.shift?.outcome === 'lost' ? lossLesson(next.shift) : null;
}

export function completeTutorial() {
  commit({ ...state, tutorialDone: true });
}

export function setSoundOn(on: boolean) {
  commit({ ...state, soundOn: on });
}
