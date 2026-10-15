import { AnimatePresence, motion } from 'motion/react';
import { Lock, Package, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildCard, type Card } from '../game/cards';
import { ACHIEVEMENTS, levelFor, statsOf } from '../game/rules';
import { todayQuests, type GameState } from '../game/store';
import { CARD_SETS, setProgress, weekStats, weeklyGoalsFor, WEEKLY_XP } from '../game/progression';
import { describeGoal, tierFor } from '../game/shift';
import { RARITY_COLOR } from '../lib/flights';
import { CardDetail } from './CardDetail';
import { CardTile } from './CardTile';

type Tab = 'cards' | 'sets' | 'goals' | 'shifts' | 'achievements';
type Filter = 'all' | 'rare' | 'foil';

interface Props {
  game: GameState;
  now: number;
  onClose: () => void;
  onOpenPack: () => void;
}

/** The wallet: your collection of real aircraft as cards, plus shifts, achievements and quests. */
export function Logbook({ game, now, onClose, onOpenPack }: Props) {
  const [tab, setTab] = useState<Tab>('cards');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Card | null>(null);
  const level = levelFor(game.xp);
  const stats = statsOf(game.records);

  const cards = useMemo(() => [...game.records].reverse().map(buildCard), [game.records]);
  const shown = cards.filter((c) => {
    if (filter === 'rare') return c.rarity !== 'common';
    if (filter === 'foil') return c.foil;
    return true;
  });

  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-stretch md:justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Wallet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 36 }}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink/95 shadow-2xl md:h-full md:max-h-none md:w-[480px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <header className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Wallet</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white">{level.title}</h2>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-400">
              Level {level.level} · {game.xp.toLocaleString('en-US')} XP · {(level.xpForNext - level.xpIntoLevel).toLocaleString('en-US')} to next
            </p>
            <div className="mt-3 h-1.5 w-60 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300"
                initial={false}
                animate={{ width: `${Math.round(level.progress * 100)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close wallet" className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="mx-6 grid grid-cols-4 gap-2">
          <Stat label="Cards" value={stats.count} />
          <Stat label="Packs" value={game.packs} accent />
          <Stat label="Shifts won" value={game.shiftLog.won} />
          <Stat label="Epic+" value={stats.rarity.epic + stats.rarity.legendary} />
        </div>

        <div className="mx-6 mt-4 flex items-center justify-between gap-3">
          <nav className="flex gap-1 border-b border-white/10" role="tablist" aria-label="Wallet sections">
            {(['cards', 'sets', 'goals', 'shifts', 'achievements'] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative px-3 pb-3 pt-2 font-display text-sm capitalize transition ${tab === t ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {t}
                {tab === t && <motion.span layoutId="wallet-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" />}
              </button>
            ))}
          </nav>
          {game.packs > 0 && (
            <button
              type="button"
              onClick={onOpenPack}
              className="mb-2 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-300 to-fuchsia-400 px-3 py-1.5 font-display text-xs font-semibold text-ink shadow-lg"
            >
              <Package className="size-3.5" aria-hidden />
              Open pack
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === 'cards' && (
                <>
                  <div className="mb-4 flex gap-1.5" role="group" aria-label="Filter cards">
                    {(['all', 'rare', 'foil'] as Filter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        aria-pressed={filter === f}
                        className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition ${filter === f ? 'bg-white text-ink' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                      >
                        {f === 'rare' ? 'Rare+' : f}
                      </button>
                    ))}
                  </div>
                  {shown.length === 0 ? (
                    <EmptyCards />
                  ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {shown.map((c) => (
                        <li key={c.id}>
                          <CardTile card={c} onOpen={setOpen} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {tab === 'sets' && <Sets records={game.records} claimed={game.setsClaimed} />}
              {tab === 'goals' && (
                <>
                  <Weekly game={game} now={now} />
                  <Quests game={game} now={now} />
                </>
              )}
              {tab === 'shifts' && <Shifts game={game} />}
              {tab === 'achievements' && <Achievements unlocked={game.achievements} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      <AnimatePresence>
        {open && (
          <CardDetail
            card={open}
            history={{
              sameType: game.records.filter((r) => r.type === open.typeCode).length,
              sameAirline: game.records.filter((r) => open.airline !== null && r.airline === open.airline).length,
              total: game.records.length,
            }}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`font-mono text-xl tabular-nums ${accent ? 'text-amber-300' : 'text-white'}`}>{value.toLocaleString('en-US')}</dd>
    </div>
  );
}

function EmptyCards() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
      <p className="font-display text-base text-white">Your wallet is empty</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Click a plane on the map and hold to catch it. Each catch becomes a card with the real facts about that aircraft.
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider" style={{ color: RARITY_COLOR.rare }}>
        Tip: win a Sky Shift to earn a pack of live aircraft
      </p>
    </div>
  );
}

function Sets({ records, claimed }: { records: GameState['records']; claimed: string[] }) {
  return (
    <ul className="space-y-3">
      {CARD_SETS.map((s) => {
        const p = setProgress(s, records);
        const pct = Math.round((p.owned / p.need) * 100);
        return (
          <li key={s.id} className="rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-sm font-semibold text-white">{s.title}</p>
              <span className={`font-mono text-[11px] tabular-nums ${p.complete ? 'text-emerald-300' : 'text-slate-400'}`}>
                {p.complete ? (claimed.includes(s.id) ? 'Complete · paid' : 'Complete') : `${p.owned}/${p.need}`}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{s.blurb}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${p.complete ? 'bg-emerald-400' : 'bg-violet-400'}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Weekly({ game, now }: { game: GameState; now: number }) {
  const goals = weeklyGoalsFor(weekStats(game.records, game.shiftWinsByWeek, now));
  return (
    <div className="mb-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">This week</p>
      <ul className="space-y-2">
        {goals.map(({ goal, progress, done }) => (
          <li key={goal.id} className="rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className={`font-display text-sm font-medium ${done ? 'text-emerald-300' : 'text-white'}`}>{goal.title}</p>
              <span className="font-mono text-xs tabular-nums text-slate-400">
                {progress}/{goal.target}
              </span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-amber-300'}`}
                initial={false}
                animate={{ width: `${(progress / goal.target) * 100}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 24 }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-600">Resets Monday · {WEEKLY_XP} XP each</p>
    </div>
  );
}

function Shifts({ game }: { game: GameState }) {
  const tier = tierFor(game.shiftLog.won);
  const next = tierFor(game.shiftLog.won + 1);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/[0.04] p-4">
        <p className="font-display text-sm font-semibold text-white">Your tier: {tier.name}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{describeGoal(tier)}.</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Win to reach {next.name}, where the goal rises to {next.catches} catches. Run out of time first and the shift is lost.
          Rare aircraft that leave the view before you catch them count as escapes.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Won" value={game.shiftLog.won} accent />
        <Stat label="Lost" value={game.shiftLog.lost} />
        <Stat label="Escapes" value={game.escapes} />
      </div>
    </div>
  );
}

function Achievements({ unlocked }: { unlocked: Record<string, number> }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {ACHIEVEMENTS.map((a) => {
        const done = a.id in unlocked;
        return (
          <li key={a.id} className={`rounded-2xl border p-3 ${done ? 'border-amber-300/25 bg-amber-300/[0.06]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
            <div className="flex items-center gap-1.5">
              {!done && <Lock className="size-3 text-slate-500" aria-hidden />}
              <p className={`font-display text-sm font-medium ${done ? 'text-amber-200' : 'text-slate-300'}`}>{a.title}</p>
            </div>
            <p className="mt-1 text-xs leading-snug text-slate-500">{a.description}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Quests({ game, now }: { game: GameState; now: number }) {
  const quests = todayQuests(game, now);
  return (
    <ul className="space-y-2">
      {quests.map(({ def, progress, done }) => (
        <li key={def.id} className="rounded-2xl bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className={`font-display text-sm font-medium ${done ? 'text-emerald-300 line-through decoration-emerald-300/50' : 'text-white'}`}>{def.title}</p>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {progress}/{def.target}
            </span>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-sky-400'}`}
              initial={false}
              animate={{ width: `${(progress / def.target) * 100}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 24 }}
            />
          </div>
        </li>
      ))}
      <li className="pt-2 text-center font-mono text-[10px] uppercase tracking-wider text-slate-600">New quests every day</li>
    </ul>
  );
}
