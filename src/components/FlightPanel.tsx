import { animate, motion, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useRef } from 'react';
import { airframeFor } from '../data/airframes';
import { airlineFor } from '../lib/airline';
import { RARITY_COLOR, RARITY_LABEL, type Blip } from '../lib/flights';
import { formatAltitude, formatSpeed } from '../lib/format';
import { rarityOf } from '../../shared/aircraft';
import type { CatchRecord } from '../game/rules';

const HOLD_MS = 700;

interface Props {
  blip: Blip;
  caught: CatchRecord | undefined;
  onCatch: () => void;
  onClose: () => void;
}

/** The selected blip. Catching is a hold gesture: the ring fills, then the catch fires. */
export function FlightPanel({ blip, caught, onCatch, onClose }: Props) {
  const rarity = rarityOf(blip.type, blip.category);
  const color = RARITY_COLOR[rarity];
  const airline = airlineFor(blip.callsign);
  const airframe = airframeFor(blip.type);
  const progress = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);

  function startHold() {
    if (caught) return;
    controls.current?.stop();
    controls.current = animate(progress, 1, { duration: HOLD_MS / 1000, ease: 'linear', onComplete: onCatch });
  }

  function cancelHold() {
    controls.current?.stop();
    controls.current = animate(progress, 0, { duration: 0.2 });
  }

  const stats: [string, string][] = [
    ['Altitude', formatAltitude(blip)],
    ['Speed', formatSpeed(blip.gs)],
    ['Heading', `${Math.round(blip.track)}°`],
    ['Squawk', blip.squawk ?? '—'],
  ];

  return (
    <motion.section
      key={blip.hex}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      aria-label={`Selected aircraft ${blip.callsign}`}
      className="pointer-events-auto relative w-full overflow-hidden rounded-3xl border border-white/10 bg-ink/80 p-5 shadow-2xl backdrop-blur-2xl md:w-[340px]"
    >
      <div className="absolute inset-x-0 top-0 h-24 opacity-30" style={{ background: `radial-gradient(120% 100% at 0% 0%, ${color}, transparent 70%)` }} aria-hidden />

      <header className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color, background: `${color}1a` }}>
            <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
            {RARITY_LABEL[rarity]}
          </span>
          <h2 className="mt-3 truncate font-mono text-3xl font-semibold tracking-tight text-white">{blip.callsign}</h2>
          <p className="truncate text-sm text-slate-400">
            {airline ?? 'Unknown operator'}
            {airframe ? (
              <span className="text-slate-500">
                {' '}
                · {airframe.name} · {airframe.engines} engine{airframe.engines === 1 ? '' : 's'}
              </span>
            ) : (
              blip.type && <span className="text-slate-500"> · {blip.type}</span>
            )}
            {blip.reg && <span className="font-mono text-slate-500"> · {blip.reg}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <dl className="relative mt-5 grid grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl bg-white/[0.04] px-2 py-2">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-0.5 truncate font-mono text-xs tabular-nums text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-5">
        {caught ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 py-4 font-display text-sm font-medium text-emerald-300">
            <Check className="size-4" aria-hidden />
            In your logbook · {new Date(caught.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : (
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) onCatch();
            }}
            className="group relative w-full touch-none select-none overflow-hidden rounded-2xl py-4 font-display text-base font-semibold text-ink transition active:scale-[0.99]"
            style={{ background: color }}
          >
            <motion.span
              className="absolute inset-0 origin-left bg-white/60"
              style={{ scaleX: progress }}
              aria-hidden
            />
            <span className="relative">Hold to catch</span>
            <span className="relative mt-0.5 block font-mono text-[10px] font-medium opacity-70">
              Enter for a quick catch
            </span>
          </button>
        )}
      </div>
    </motion.section>
  );
}
