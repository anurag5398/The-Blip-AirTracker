import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { todayQuests, type GameState } from '../game/store';

interface Props {
  game: GameState;
  now: number;
}

/** Today's three quests as a compact tray. Desktop only; the logbook shows the same quests on mobile. */
export function QuestTray({ game, now }: Props) {
  const quests = todayQuests(game, now);
  const doneCount = quests.filter((q) => q.done).length;

  return (
    <section
      aria-label="Daily quests"
      className="pointer-events-auto hidden w-64 rounded-2xl border border-white/10 bg-ink/70 p-3 shadow-2xl backdrop-blur-xl md:block"
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Today's quests</p>
        <p className="font-mono text-[10px] tabular-nums text-slate-500">{doneCount}/{quests.length}</p>
      </header>
      <ul className="space-y-2">
        {quests.map(({ def, progress, done }) => (
          <li key={def.id} className="px-1">
            <div className="flex items-center gap-2">
              <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300' : 'border-white/20 text-transparent'}`} aria-hidden>
                <Check className="size-2.5" />
              </span>
              <p className={`truncate text-xs ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{def.title}</p>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-slate-500">{progress}/{def.target}</span>
            </div>
            <div className="ml-6 mt-1 h-0.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full ${done ? 'bg-emerald-400' : 'bg-sky-400'}`}
                initial={false}
                animate={{ width: `${(progress / def.target) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
