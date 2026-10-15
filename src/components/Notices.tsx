import { AnimatePresence, motion } from 'motion/react';
import { Award, Compass, Radio, Sparkles, Trophy } from 'lucide-react';
import { useEffect } from 'react';

export interface Notice {
  id: number;
  kind: 'achievement' | 'level' | 'quest' | 'info' | 'alert';
  title: string;
  body: string;
}

const ICON = { achievement: Award, level: Trophy, quest: Sparkles, info: Compass, alert: Radio } as const;
const TONE = {
  achievement: 'text-amber-300 border-amber-300/25',
  level: 'text-violet-300 border-violet-300/25',
  quest: 'text-emerald-300 border-emerald-300/25',
  info: 'text-sky-300 border-sky-300/25',
  alert: 'text-rose-300 border-rose-400/50 animate-pulse',
} as const;

interface Props {
  notices: Notice[];
  onDismiss: (id: number) => void;
}

/** Stacked achievement / level / quest toasts at the top centre. Each auto-dismisses. */
export function Notices({ notices, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex flex-col items-center gap-2 px-4 md:bottom-28" aria-live="polite">
      <AnimatePresence initial={false}>
        {notices.map((n) => (
          <NoticeItem key={n.id} notice={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NoticeItem({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => onDismiss(notice.id), 3200);
    return () => window.clearTimeout(id);
  }, [notice.id, onDismiss]);

  const Icon = ICON[notice.kind];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-ink/85 px-4 py-3 shadow-2xl backdrop-blur-xl ${TONE[notice.kind]}`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-white">{notice.title}</p>
        <p className="truncate text-xs text-slate-400">{notice.body}</p>
      </div>
    </motion.div>
  );
}
