import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Identify the sky',
    body: 'Every contact on the radar is a real aircraft. In a mission, their types are hidden. Open a contact to read its data tag.',
  },
  {
    title: 'Two-minute mission',
    body: 'Each mission sets a target, such as three helicopters or five widebodies. Log contacts that match and pass on the rest. Wrong logs cost points, and streaks multiply your score.',
  },
  {
    title: 'Scores and patrol',
    body: 'Post your score to the leaderboard when the two minutes end. Between missions, patrol the sky in open play and catch aircraft for cards.',
  },
];

interface Props {
  onDone: () => void;
}

/** First run. States what the game is, and says plainly that positions are estimates. */
export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end justify-items-center bg-black/50 p-4 pb-8 backdrop-blur-[3px] md:place-items-center md:pb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="About blip"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-[#0a1020]/95 p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">Live aircraft · Game</p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            <h2 className="mt-3 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white">{current.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-sky-400' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!last && (
              <button type="button" onClick={onDone} className="rounded-xl px-3 py-2.5 font-display text-sm text-slate-400 hover:text-white">
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onDone() : setStep(step + 1))}
              className="rounded-2xl bg-white px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-sky-100"
            >
              {last ? 'Start hunting' : 'Continue'}
            </button>
          </div>
        </div>

        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-slate-500">
          For information and play only, never for navigation or travel decisions. Positions are estimates and can lag by a few minutes. Check
          with your airline for flight status.
        </p>
      </motion.section>
    </motion.div>
  );
}
