export interface ScoreRow {
  name: string;
  score: number;
  accuracy: number;
  bestStreak: number;
  at: number;
}

export interface Submission {
  name: string;
  score: number;
  accuracy: number;
  bestStreak: number;
}

export interface BoardResult {
  rank: number | null;
  top: ScoreRow[];
}

export async function fetchBoard(): Promise<ScoreRow[]> {
  const res = await fetch('/api/scores');
  if (!res.ok) throw new Error(`scores ${res.status}`);
  return ((await res.json()) as { top: ScoreRow[] }).top;
}

/** Sends one mission result. The server validates everything, so a rejected result shows the reason. */
export async function submitScore(s: Submission): Promise<BoardResult> {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  const body = (await res.json()) as BoardResult & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `scores ${res.status}`);
  return body;
}
