import { BookOpen, Flame, Locate, Search, Volume2, VolumeX, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { FeedStatus } from '../hooks/useAirspace';
import { COMBO_WINDOW_MS, levelFor, type Combo, type Streak } from '../game/rules';

interface Props {
  status: FeedStatus;
  dataAgeMs: number | null;
  now: number;
  tracked: number;
  /** Regions verified live, and the total. Null when everything is live. */
  warming: { live: number; total: number } | null;
  filter: string | null;
  xp: number;
  streak: Streak;
  combo: Combo;
  inMission: boolean;
  soundOn: boolean;
  onOpenWallet: () => void;
  onToggleSound: () => void;
  onLocate: () => void;
  onSearch: (query: string) => void;
  onClearFilter: () => void;
  onStartMission: () => void;
}

/** One control height and one surface style for everything in the bar, so it reads as a single instrument. */
const SURFACE = 'rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl';
const CONTROL = 'h-10';

const STATUS_TEXT: Record<FeedStatus, string> = {
  idle: 'Starting',
  warming: 'Warming up',
  live: 'Live',
  degraded: 'Reconnecting',
  offline: 'Server unreachable',
};

const STATUS_DOT: Record<FeedStatus, string> = {
  idle: 'bg-slate-400',
  warming: 'bg-sky-400',
  live: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  offline: 'bg-rose-500',
};

export function Header({
  status,
  dataAgeMs,
  now,
  tracked,
  warming,
  filter,
  xp,
  streak,
  combo,
  inMission,
  soundOn,
  onOpenWallet,
  onToggleSound,
  onLocate,
  onSearch,
  onClearFilter,
  onStartMission,
}: Props) {
  const level = levelFor(xp);
  const age = dataAgeMs === null ? null : Math.round(dataAgeMs / 1000);
  const [query, setQuery] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onSearch(q);
    setQuery('');
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-3 md:p-4">
      <div className={`pointer-events-auto flex ${CONTROL} items-center gap-3 px-3 ${SURFACE}`}>
        <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">blip</span>
        <span className="h-4 w-px bg-white/10" aria-hidden />
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400" role="status">
          <span className={`size-1.5 rounded-full ${STATUS_DOT[status]} ${status === 'live' ? 'animate-pulse' : ''}`} aria-hidden />
          {warming ? `Simulated · ${warming.live}/${warming.total} regions live` : STATUS_TEXT[status]}
          {!warming && status === 'live' && age !== null && <span className="text-slate-500">· {age}s</span>}
          {!warming && status === 'live' && <span className="text-slate-500">· {tracked}</span>}
        </p>
      </div>

      {!inMission && (
        <div className="pointer-events-auto order-3 flex w-full justify-center md:order-none md:w-auto md:flex-1">
          <button
            type="button"
            onClick={onStartMission}
            className="flex h-10 items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-4 font-display text-[13px] font-semibold text-ink shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] transition hover:bg-sky-100"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            Start 2-minute mission
          </button>
        </div>
      )}

      <div className="pointer-events-auto ml-auto flex items-center gap-2">
        <form onSubmit={submit} className="hidden lg:block">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Callsign or type, e.g. A380"
              aria-label="Find a flight by callsign or aircraft type"
              className={`${CONTROL} w-56 rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 pl-9 pr-3 font-mono text-sm uppercase text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl placeholder:normal-case placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none`}
            />
          </label>
        </form>

        {filter && (
          <button
            type="button"
            onClick={onClearFilter}
            className={`${CONTROL} flex items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-wider text-sky-200 ${SURFACE}`}
            aria-label={`Showing only ${filter}. Clear filter`}
          >
            {filter}
            <X className="size-3.5" aria-hidden />
          </button>
        )}

        {combo.chain > 0 && <ComboPill combo={combo} now={now} />}

        <div className={`${CONTROL} flex items-center gap-2 px-3 ${SURFACE}`} title={`${streak.days}-day streak`}>
          <Flame className={`size-4 ${streak.days > 0 ? 'text-amber-400' : 'text-slate-600'}`} aria-hidden />
          <span className="font-mono text-sm tabular-nums text-white">{streak.days}</span>
        </div>

        <button
          type="button"
          onClick={onOpenWallet}
          className={`${CONTROL} group flex items-center gap-2.5 pl-1.5 pr-3 transition hover:border-white/20 ${SURFACE}`}
          aria-label={`Open wallet. Level ${level.level}, ${level.title}`}
        >
          <LevelRing progress={level.progress} level={level.level} />
          <span className="hidden text-left sm:block">
            <span className="block font-display text-[13px] font-medium leading-tight text-white">{level.title}</span>
            <span className="block font-mono text-[10px] tabular-nums text-slate-400">{xp.toLocaleString('en-US')} XP</span>
          </span>
          <BookOpen className="ml-1 size-4 text-slate-400 transition group-hover:text-white" aria-hidden />
        </button>

        <IconButton label={soundOn ? 'Mute sounds' : 'Turn sounds on'} onClick={onToggleSound}>
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconButton>
        <IconButton label="Find my location" onClick={onLocate}>
          <Locate className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}

const COMBO_COLOR = ['#94a3b8', '#5eead4', '#38bdf8', '#c084fc', '#fbbf24', '#f43f5e'];

/** Multiplier pill. The bar drains over the combo window, so you can see how long the chain has left. */
function ComboPill({ combo, now }: { combo: Combo; now: number }) {
  const left = Math.max(0, 1 - (now - combo.last) / COMBO_WINDOW_MS);
  const color = COMBO_COLOR[Math.min(combo.multiplier, COMBO_COLOR.length - 1)];
  return (
    <div
      className="relative flex h-10 min-w-[72px] flex-col justify-center overflow-hidden rounded-2xl border px-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      style={{ borderColor: `${color}55`, background: 'rgba(10,16,32,0.8)' }}
      role="status"
      aria-label={`Combo x${combo.multiplier}, ${combo.chain} in a row`}
    >
      <p className="font-mono text-[12px] font-semibold tabular-nums" style={{ color }}>
        x{combo.multiplier} <span className="text-[10px] font-normal text-slate-400">· {combo.chain}</span>
      </p>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
        <div className="h-full origin-left transition-transform duration-300" style={{ background: color, transform: `scaleX(${left})` }} />
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`${CONTROL} grid aspect-square place-items-center rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 text-slate-300 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl transition hover:border-white/20 hover:text-white`}
    >
      {children}
    </button>
  );
}

function LevelRing({ progress, level }: { progress: number; level: number }) {
  const dash = 2 * Math.PI * 15;
  return (
    <span className="relative grid size-7 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - Math.max(0.02, Math.min(1, progress)))}
        />
      </svg>
      <span className="font-mono text-[10px] font-semibold tabular-nums text-white">{level}</span>
    </span>
  );
}
