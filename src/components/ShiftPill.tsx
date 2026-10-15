import { motion } from 'motion/react';
import { Play, Timer } from 'lucide-react';
import { SHIFT_MS, shiftRemainingMs, type Shift } from '../game/shift';

interface Props {
  shift: Shift | null;
  now: number;
  onStart: () => void;
}

/** The round's objective, always visible: tier, time left, and progress toward the goal. */
export function ShiftPill({ shift, now, onStart }: Props) {
  if (!shift || shift.outcome !== 'active') {
    const label =
      shift?.outcome === 'won'
        ? 'Shift won · start the next tier'
        : shift?.outcome === 'lost'
          ? 'Shift lost · try again'
          : 'Start a Sky Shift';
    return (
      <button
        type="button"
        onClick={onStart}
        className="pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-4 py-2.5 font-display text-sm font-semibold text-ink shadow-2xl transition hover:brightness-110"
      >
        <Play className="size-4" aria-hidden />
        {label}
      </button>
    );
  }

  const { tier } = shift;
  const left = shiftRemainingMs(shift, now);
  const mins = Math.floor(left / 60_000);
  const secs = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
  const progress = Math.min(
    1,
    (Math.min(shift.catches, tier.catches) / tier.catches + Math.min(shift.special, tier.count) / tier.count) / 2,
  );
  const urgent = left < 30_000;

  return (
    <div
      className={`pointer-events-auto relative min-w-[220px] overflow-hidden rounded-2xl border bg-ink/80 px-4 py-2.5 shadow-2xl backdrop-blur-xl ${urgent ? 'border-rose-400/60' : 'border-sky-300/25'}`}
      role="status"
      aria-label={`Sky Shift, ${tier.name} tier: ${shift.catches} of ${tier.catches} catches, ${mins} minutes ${secs} seconds left`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-sky-300">
          <Timer className="size-3.5" aria-hidden />
          {tier.name}
        </span>
        <span className={`font-mono text-sm tabular-nums ${urgent ? 'text-rose-300' : 'text-white'}`}>
          {mins}:{secs}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-400">
        {shift.catches}/{tier.catches} catches · {shift.special}/{tier.count} {tier.special}+
      </p>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 24 }}
        />
      </div>
      <span className="sr-only">Round length {SHIFT_MS / 60_000} minutes</span>
    </div>
  );
}
