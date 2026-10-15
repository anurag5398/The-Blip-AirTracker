import { airframeFor } from '../data/airframes';
import { rarityOf } from '../../shared/aircraft';
import { squawkAlert } from './rules';

/** A mega-mission lasts two minutes. Contacts are unlabelled until you open them. */
export const MISSION_MS = 120_000;
export const PTS_CORRECT = 100;
export const PTS_STREAK_STEP = 10;
export const PTS_GOAL_BONUS = 250;
export const PTS_WRONG = -50;

/** The subset of aircraft data a goal can look at. Keeps the rules independent of the map. */
export interface Contact {
  hex: string;
  type: string | null;
  category: string | null;
  alt: number | null;
  squawk: string | null;
}

export interface Goal {
  id: string;
  /** Shown on the mission bar, for example "Log 5 widebodies" */
  title: string;
  need: number;
  matches: (c: Contact) => boolean;
}

export const GOALS: Goal[] = [
  {
    id: 'widebody',
    title: 'Log 5 widebody airliners',
    need: 5,
    matches: (c) => {
      const r = rarityOf(c.type, c.category);
      return r === 'epic' || r === 'legendary';
    },
  },
  { id: 'rotor', title: 'Log 3 helicopters', need: 3, matches: (c) => c.category === 'A7' },
  { id: 'bizjet', title: 'Log 4 business jets', need: 4, matches: (c) => airframeFor(c.type)?.kind === 'bizjet' },
  { id: 'high', title: 'Log 6 aircraft above FL350', need: 6, matches: (c) => (c.alt ?? 0) >= 35_000 },
  { id: 'alert', title: 'Log 2 special squawks', need: 2, matches: (c) => squawkAlert(c.squawk) !== null },
];

/** Goals rotate from a seed so each mission asks something different, but the same seed gives the same order. */
export function goalOrder(seed: number): Goal[] {
  const start = Math.abs(Math.floor(seed)) % GOALS.length;
  return [...GOALS.slice(start), ...GOALS.slice(0, start)];
}

export interface MissionState {
  startedAt: number;
  seed: number;
  goals: Goal[];
  goalIndex: number;
  progress: number;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  /** Contacts already logged or passed, so a tap can't score twice */
  handled: string[];
  goalsCompleted: number;
}

export function startMission(now: number, seed: number): MissionState {
  return {
    startedAt: now,
    seed,
    goals: goalOrder(seed),
    goalIndex: 0,
    progress: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    wrong: 0,
    handled: [],
    goalsCompleted: 0,
  };
}

export function currentGoal(s: MissionState): Goal {
  return s.goals[s.goalIndex % s.goals.length];
}

export function timeLeftMs(s: MissionState, now: number): number {
  return Math.max(0, MISSION_MS - (now - s.startedAt));
}

export function isOver(s: MissionState, now: number): boolean {
  return timeLeftMs(s, now) === 0;
}

export type MissionAction = { type: 'log' | 'pass'; contact: Contact };

/**
 * One decision on one contact. Logging a match scores and builds a streak; logging a non-match costs
 * points and breaks the streak. Passing is neutral. Completing a goal pays a bonus and rolls to the next.
 */
export function missionStep(s: MissionState, action: MissionAction, now: number): MissionState {
  if (isOver(s, now)) return s;
  if (s.handled.includes(action.contact.hex)) return s;
  const handled = [...s.handled, action.contact.hex];

  if (action.type === 'pass') return { ...s, handled };

  const goal = currentGoal(s);
  if (!goal.matches(action.contact)) {
    return { ...s, handled, score: Math.max(0, s.score + PTS_WRONG), streak: 0, wrong: s.wrong + 1 };
  }

  const streak = s.streak + 1;
  let score = s.score + PTS_CORRECT + (streak - 1) * PTS_STREAK_STEP;
  let progress = s.progress + 1;
  let goalIndex = s.goalIndex;
  let goalsCompleted = s.goalsCompleted;
  if (progress >= goal.need) {
    score += PTS_GOAL_BONUS;
    progress = 0;
    goalIndex += 1;
    goalsCompleted += 1;
  }
  return {
    ...s,
    handled,
    score,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    progress,
    goalIndex,
    goalsCompleted,
    correct: s.correct + 1,
  };
}

export function accuracy(s: MissionState): number {
  const total = s.correct + s.wrong;
  return total === 0 ? 0 : s.correct / total;
}

/** Score for the leaderboard, with a rank label a player can read. */
export function rankLabel(score: number): string {
  if (score >= 3000) return 'Air Marshal';
  if (score >= 2000) return 'Senior Controller';
  if (score >= 1000) return 'Controller';
  if (score >= 400) return 'Trainee';
  return 'Observer';
}
