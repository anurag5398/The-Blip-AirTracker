import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * High scores for the two-minute mission. Small by design: the top N are kept in one JSON file.
 * Everything a player sends is validated here, at the boundary, before it is stored or shown.
 */
export interface ScoreEntry {
  name: string;
  score: number;
  accuracy: number;
  bestStreak: number;
  at: number;
}

const KEEP = 100;
const MAX_SCORE = 100_000;
const MAX_STREAK = 500;
const NAME = /^[A-Za-z0-9 _.-]{2,16}$/;

export type Validated = { ok: true; entry: Omit<ScoreEntry, 'at'> } | { ok: false; error: string };

export function validateScore(input: unknown): Validated {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'expected an object' };
  const r = input as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!NAME.test(name)) return { ok: false, error: 'name must be 2–16 letters, numbers, spaces, . _ -' };
  const score = r.score;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > MAX_SCORE) {
    return { ok: false, error: 'score out of range' };
  }
  const accuracy = r.accuracy;
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) {
    return { ok: false, error: 'accuracy must be between 0 and 1' };
  }
  const bestStreak = r.bestStreak;
  if (!Number.isInteger(bestStreak) || (bestStreak as number) < 0 || (bestStreak as number) > MAX_STREAK) {
    return { ok: false, error: 'streak out of range' };
  }
  return {
    ok: true,
    entry: { name, score: score as number, accuracy, bestStreak: bestStreak as number },
  };
}

export class Leaderboard {
  private entries: ScoreEntry[] = [];

  constructor(
    private readonly path?: string,
    private readonly now: () => number = Date.now,
  ) {
    this.load();
  }

  top(n: number): ScoreEntry[] {
    return this.entries.slice(0, n);
  }

  /** Stores the entry and returns its 1-based rank, or null if it didn't make the top KEEP. */
  submit(entry: Omit<ScoreEntry, 'at'>): number | null {
    const row: ScoreEntry = { ...entry, at: this.now() };
    this.entries = [...this.entries, row].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, KEEP);
    this.persist();
    const rank = this.entries.indexOf(row);
    return rank === -1 ? null : rank + 1;
  }

  private persist(): void {
    if (!this.path) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.entries));
      renameSync(tmp, this.path);
    } catch (err) {
      // The score is still in memory and on the board for this instance; say so rather than fail the request
      console.warn(`[scores] could not save: ${String(err)}`);
    }
  }

  private load(): void {
    if (!this.path || !existsSync(this.path)) return;
    try {
      const data = JSON.parse(readFileSync(this.path, 'utf8')) as ScoreEntry[];
      this.entries = Array.isArray(data) ? data.slice(0, KEEP) : [];
    } catch {
      this.entries = [];
    }
  }
}
