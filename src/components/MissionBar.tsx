interface Props {
  timeLeftMs: number;
  goalTitle: string;
  progress: number;
  need: number;
  score: number;
  streak: number;
  onEnd: () => void;
}

/** The mission's instrument strip: time, the current target, score and streak. */
export function MissionBar({ timeLeftMs, goalTitle, progress, need, score, streak, onEnd }: Props) {
  const secs = Math.ceil(timeLeftMs / 1000);
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, '0');
  const urgent = secs <= 15;

  return (
    <div className="atc-panel pointer-events-auto flex items-stretch divide-x divide-phosphor/20 font-mono text-phosphor" role="status" aria-label="Mission">
      <div className="px-4 py-2">
        <p className="text-[10px] tracking-[0.2em] text-phosphor/60">TIME</p>
        <p className={`text-xl tabular-nums ${urgent ? 'text-amber-300' : 'text-phosphor'}`}>
          {mm}:{ss}
        </p>
      </div>
      <div className="min-w-[200px] px-4 py-2">
        <p className="text-[10px] tracking-[0.2em] text-phosphor/60">TARGET</p>
        <p className="text-[13px] text-phosphor">{goalTitle}</p>
        <div className="mt-1.5 flex items-center gap-1" aria-label={`${progress} of ${need}`}>
          {Array.from({ length: need }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 ${i < progress ? 'bg-phosphor' : 'bg-phosphor/15'}`} />
          ))}
        </div>
      </div>
      <div className="px-4 py-2">
        <p className="text-[10px] tracking-[0.2em] text-phosphor/60">SCORE</p>
        <p className="text-xl tabular-nums text-phosphor">{score.toLocaleString('en-US')}</p>
      </div>
      <div className="px-4 py-2">
        <p className="text-[10px] tracking-[0.2em] text-phosphor/60">STREAK</p>
        <p className="text-xl tabular-nums text-phosphor">{streak}</p>
      </div>
      <button type="button" onClick={onEnd} className="px-3 text-[10px] uppercase tracking-[0.2em] text-phosphor/60 hover:text-phosphor">
        End
      </button>
    </div>
  );
}
