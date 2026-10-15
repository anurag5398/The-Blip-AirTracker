import { AnimatePresence, motion } from 'motion/react';
import { Target } from 'lucide-react';
import { ESCAPE_GRACE_MS, type Bounty } from '../game/bounties';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/flights';

interface Props {
  bounties: Bounty[];
  visible: ReadonlySet<string>;
  now: number;
  onFocus: (hex: string) => void;
}

/** Live bounties: what's worth chasing right now, and how long a plane out of view has before it escapes. */
export function BountyBanner({ bounties, visible, now, onFocus }: Props) {
  const top = bounties.slice(0, 2);
  return (
    <div className="pointer-events-none flex flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {top.map((b) => {
          const color = RARITY_COLOR[b.rarity];
          const inView = visible.has(b.hex);
          const escapesIn = Math.max(0, Math.ceil((ESCAPE_GRACE_MS - (now - b.lastSeenAt)) / 1000));
          return (
            <motion.button
              key={b.hex}
              type="button"
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              onClick={() => onFocus(b.hex)}
              disabled={!inView}
              className="pointer-events-auto flex w-64 items-center gap-3 rounded-2xl border bg-ink/80 px-3 py-2.5 text-left shadow-2xl backdrop-blur-xl disabled:opacity-70"
              style={{ borderColor: `${color}66` }}
              aria-label={`Bounty ${b.callsign}, ${RARITY_LABEL[b.rarity]}${inView ? ', in view' : `, out of view, escapes in ${escapesIn} seconds`}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
                <Target className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
                  Bounty · {RARITY_LABEL[b.rarity]}
                </span>
                <span className="block truncate font-display text-sm font-semibold text-white">
                  {b.type ?? 'Unknown'} · {b.callsign}
                </span>
                <span className={`block font-mono text-[10px] tabular-nums ${inView ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {inView ? 'In view. Catch it.' : `Out of view. Escapes in ${escapesIn}s`}
                </span>
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
