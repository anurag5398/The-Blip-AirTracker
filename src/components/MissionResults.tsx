import { useEffect, useState, type FormEvent } from 'react';
import { fetchBoard, submitScore, type ScoreRow, type Submission } from '../lib/scores';
import { rankLabel } from '../game/mission';

export interface MissionOutcome {
  score: number;
  accuracy: number;
  bestStreak: number;
  correct: number;
  wrong: number;
  goalsCompleted: number;
}

interface Props {
  outcome: MissionOutcome;
  onPlayAgain: () => void;
  onExit: () => void;
}

const NAME_KEY = 'blip:callsign';

/** Mission debrief: your numbers, a name for the board, and the board itself. */
export function MissionResults({ outcome, onPlayAgain, onExit }: Props) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [rank, setRank] = useState<number | null>(null);
  const [board, setBoard] = useState<ScoreRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBoard().then(setBoard).catch(() => setError('Leaderboard unavailable right now.'));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload: Submission = {
      name: name.trim(),
      score: Math.round(outcome.score),
      accuracy: Number(outcome.accuracy.toFixed(4)),
      bestStreak: outcome.bestStreak,
    };
    setStatus('sending');
    setError(null);
    try {
      const res = await submitScore(payload);
      localStorage.setItem(NAME_KEY, payload.name);
      setRank(res.rank);
      setBoard(res.top);
      setStatus('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setStatus('error');
    }
  }

  const acc = Math.round(outcome.accuracy * 100);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Mission debrief">
      <div className="atc-panel scanlines w-full max-w-lg font-mono text-phosphor">
        <header className="border-b border-phosphor/20 px-6 py-4">
          <p className="text-[10px] tracking-[0.25em] text-phosphor/60">MISSION COMPLETE</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{outcome.score.toLocaleString('en-US')}</p>
          <p className="mt-1 text-[12px] text-phosphor/70">Rank · {rankLabel(outcome.score)}</p>
        </header>

        <dl className="grid grid-cols-4 divide-x divide-phosphor/15 border-b border-phosphor/20">
          <Stat label="ACCURACY" value={`${acc}%`} />
          <Stat label="BEST STREAK" value={String(outcome.bestStreak)} />
          <Stat label="LOGGED" value={String(outcome.correct)} />
          <Stat label="WRONG" value={String(outcome.wrong)} tone={outcome.wrong ? 'amber' : undefined} />
        </dl>

        <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-[10px] tracking-[0.2em] text-phosphor/60" htmlFor="callsign">
              ENTER YOUR CALLSIGN
            </label>
            <input
              id="callsign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              disabled={status === 'saved'}
              className="w-full rounded-sm border border-phosphor/40 bg-black/40 px-3 py-2 text-phosphor placeholder:text-phosphor/30 focus:border-phosphor focus:outline-none"
              placeholder="e.g. SPEEDBIRD"
            />
            <button
              type="submit"
              disabled={status === 'sending' || status === 'saved' || name.trim().length < 2}
              className="w-full rounded-sm border border-phosphor bg-phosphor/15 py-2.5 uppercase tracking-wider text-phosphor transition hover:bg-phosphor/25 disabled:opacity-40"
            >
              {status === 'saved' ? `Saved · rank ${rank ?? '—'}` : status === 'sending' ? 'Saving…' : 'Submit score'}
            </button>
            {error && <p className="text-[11px] text-amber-300">{error}</p>}
          </form>

          <div>
            <p className="mb-2 text-[10px] tracking-[0.2em] text-phosphor/60">TOP CONTROLLERS</p>
            <ol className="space-y-1 text-[12px]">
              {board.slice(0, 8).map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex justify-between gap-3 tabular-nums">
                  <span className="truncate text-phosphor/80">
                    {i + 1}. {r.name}
                  </span>
                  <span className="text-phosphor">{r.score.toLocaleString('en-US')}</span>
                </li>
              ))}
              {board.length === 0 && <li className="text-phosphor/50">No scores yet. Be first.</li>}
            </ol>
          </div>
        </div>

        <footer className="flex gap-2 border-t border-phosphor/20 px-6 py-4">
          <button type="button" onClick={onPlayAgain} className="flex-1 rounded-sm border border-phosphor bg-phosphor/15 py-2.5 uppercase tracking-wider text-phosphor hover:bg-phosphor/25">
            Play again
          </button>
          <button type="button" onClick={onExit} className="flex-1 rounded-sm border border-phosphor/30 py-2.5 uppercase tracking-wider text-phosphor/70 hover:text-phosphor">
            Open patrol
          </button>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[9px] tracking-[0.2em] text-phosphor/50">{label}</dt>
      <dd className={`mt-1 text-lg tabular-nums ${tone === 'amber' ? 'text-amber-300' : 'text-phosphor'}`}>{value}</dd>
    </div>
  );
}
