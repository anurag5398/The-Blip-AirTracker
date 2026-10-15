import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import type { CatchOutcome } from '../game/store';
import type { Rarity } from '../../shared/aircraft';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/flights';

const PARTICLES = 18;

// Confetti hues per rarity: the rarer the catch, the more colours burst out
const PALETTE: Record<Rarity, string[]> = {
  common: ['#5eead4', '#38bdf8'],
  rare: ['#38bdf8', '#c084fc'],
  epic: ['#c084fc', '#f472b6', '#fbbf24'],
  legendary: ['#fbbf24', '#f472b6', '#c084fc', '#38bdf8', '#34d399'],
};

interface Props {
  outcome: CatchOutcome | null;
  onDone: () => void;
}

/** Full-screen payoff for a catch. Rarer catches throw more particles and hold longer. */
export function CatchBurst({ outcome, onDone }: Props) {
  useEffect(() => {
    if (!outcome) return;
    const hold = outcome.record.rarity === 'legendary' ? 2600 : 1600;
    const id = window.setTimeout(onDone, hold);
    return () => window.clearTimeout(id);
  }, [outcome, onDone]);

  return (
    <AnimatePresence>
      {outcome && (
        <motion.div
          key={outcome.record.hex + outcome.record.at}
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          role="status"
          aria-live="polite"
        >
          <Particles palette={PALETTE[outcome.record.rarity]} count={outcome.record.rarity === 'common' ? PARTICLES / 2 : PARTICLES} />
          <motion.div
            initial={{ scale: 0.6, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className="text-center"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: RARITY_COLOR[outcome.record.rarity] }}>
              {outcome.record.rarity === 'common' ? 'Caught' : `${RARITY_LABEL[outcome.record.rarity]} catch`}
            </p>
            <p className="mt-2 font-display text-5xl font-semibold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
              {outcome.record.callsign}
            </p>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-3 font-mono text-xl tabular-nums text-amber-300"
            >
              +{outcome.xpGained} XP
            </motion.p>
            {(outcome.record.mult ?? 1) > 1 && (
              <motion.p
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 500, damping: 14 }}
                className="mt-2 font-display text-lg font-semibold text-fuchsia-300"
              >
                x{outcome.record.mult} combo!
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Particles({ palette, count }: { palette: string[]; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 140 + ((i * 37) % 90);
        const color = palette[i % palette.length];
        return (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: (i % 3) * 0.03 }}
          />
        );
      })}
    </>
  );
}
