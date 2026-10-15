import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { buildCard } from '../game/cards';
import type { CatchRecord } from '../game/rules';
import { RARITY_COLOR } from '../lib/flights';
import { CardTile } from './CardTile';

interface Props {
  record: CatchRecord | null;
  tierWon: string;
  onDone: () => void;
}

/** A shift is won: the card that completed it is revealed as a shiny foil. Tap to continue. */
export function ShinyReveal({ record, tierWon, onDone }: Props) {
  useEffect(() => {
    if (!record) return;
    const id = window.setTimeout(onDone, 9000);
    return () => window.clearTimeout(id);
  }, [record, onDone]);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key={record.hex + record.at}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/75 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
          role="dialog"
          aria-label="Shift won. Shiny card earned"
        >
          <Halo color={RARITY_COLOR[record.rarity]} />
          <motion.div
            initial={{ scale: 0.7, rotateY: -25, y: 30 }}
            animate={{ scale: 1, rotateY: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
            className="relative w-56 sm:w-64"
          >
            <CardTile card={{ ...buildCard(record), foil: true }} size="lg" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">Shift won · {tierWon}</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">A shiny card</p>
            <p className="mt-2 text-sm text-slate-400">Added to your wallet. A pack is waiting too.</p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-slate-500">Click anywhere to continue</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Halo({ color }: { color: string }) {
  return (
    <motion.div
      className="pointer-events-none absolute size-[34rem] rounded-full"
      style={{ background: `radial-gradient(closest-side, ${color}55, transparent 70%)` }}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      aria-hidden
    />
  );
}
