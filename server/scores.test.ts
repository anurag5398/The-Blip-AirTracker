import { describe, expect, it } from 'vitest';
import { Leaderboard, validateScore } from './scores';

const good = { name: 'Captain Ana', score: 1200, accuracy: 0.8, bestStreak: 6 };

describe('validateScore', () => {
  it('accepts a sensible score', () => {
    expect(validateScore(good).ok).toBe(true);
  });

  it('rejects bad names, out-of-range numbers and non-objects', () => {
    expect(validateScore({ ...good, name: '<script>' }).ok).toBe(false);
    expect(validateScore({ ...good, name: 'a' }).ok).toBe(false);
    expect(validateScore({ ...good, score: 1e9 }).ok).toBe(false);
    expect(validateScore({ ...good, score: 1.5 }).ok).toBe(false);
    expect(validateScore({ ...good, accuracy: 2 }).ok).toBe(false);
    expect(validateScore(null).ok).toBe(false);
  });
});

describe('Leaderboard', () => {
  it('ranks by score and keeps the highest first', () => {
    const board = new Leaderboard(undefined, () => 1);
    board.submit({ name: 'Low Score', score: 100, accuracy: 0.1, bestStreak: 1 });
    const rank = board.submit({ name: 'High Score', score: 900, accuracy: 0.9, bestStreak: 9 });
    expect(rank).toBe(1);
    expect(board.top(2).map((e) => e.name)).toEqual(['High Score', 'Low Score']);
  });
});
