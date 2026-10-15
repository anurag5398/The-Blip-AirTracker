import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { buildCard } from '../game/cards';
import type { CatchRecord } from '../game/rules';
import { playPackSound, playRevealSound } from '../game/sound';
import { CardTile } from './CardTile';

interface Props {
  records: CatchRecord[];
  soundOn: boolean;
  onConfirm: (records: CatchRecord[]) => void;
  onCancel: () => void;
}

/** Three live aircraft, face down. Tap each to reveal it; the rarer the plane, the bigger the reveal. */
export function PackOpener({ records, soundOn, onConfirm, onCancel }: Props) {
  const [revealed, setRevealed] = useState<boolean[]>(() => records.map(() => false));
  const allRevealed = revealed.every(Boolean);

  function reveal(i: number) {
    if (revealed[i]) return;
    if (soundOn) playRevealSound(records[i].rarity);
    setRevealed((prev) => prev.map((v, j) => (j === i ? true : v)));
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Open a pack"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl text-center"
        onAnimationStart={() => {
          if (soundOn) playPackSound();
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">Sky Shift pack</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          {allRevealed ? 'Pulled from the live sky' : 'Tap to reveal'}
        </h2>
        <p className="mt-2 text-sm text-slate-400">These aircraft are flying right now. Each becomes a card in your wallet.</p>

        <ul className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
          {records.map((r, i) => (
            <li key={r.hex}>
              <button
                type="button"
                onClick={() => reveal(i)}
                aria-label={revealed[i] ? `Revealed: ${r.callsign}` : `Reveal card ${i + 1}`}
                className="relative block aspect-[5/7] w-full [perspective:900px]"
              >
                <motion.div
                  className="relative h-full w-full [transform-style:preserve-3d]"
                  animate={{ rotateY: revealed[i] ? 0 : 180 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="absolute inset-0 [backface-visibility:hidden]">
                    <CardBack />
                  </div>
                  <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <CardTile card={buildCard(r)} />
                  </div>
                </motion.div>
              </button>
            </li>
          ))}
        </ul>

        <AnimatePresence>
          {allRevealed ? (
            <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => onConfirm(records)}
                className="rounded-2xl bg-gradient-to-r from-amber-300 to-fuchsia-400 px-6 py-3 font-display text-sm font-semibold text-ink shadow-2xl"
              >
                Add to wallet
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="skip"
              type="button"
              onClick={() => setRevealed(records.map(() => true))}
              className="mt-6 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Reveal all
            </motion.button>
          )}
        </AnimatePresence>

        <button type="button" onClick={onCancel} className="mt-4 block w-full font-mono text-[10px] uppercase tracking-wider text-slate-600 hover:text-slate-400">
          Keep for later
        </button>
      </motion.div>
    </motion.div>
  );
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-fuchsia-950">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(251,191,36,0.15) 0 2px, transparent 2px 14px)' }} aria-hidden />
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-4xl font-semibold text-amber-200/80">blip</span>
      </div>
    </div>
  );
}
