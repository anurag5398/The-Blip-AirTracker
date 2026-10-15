import type { Rarity } from '../../shared/aircraft';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/flights';
import { REGIONS, type Region } from '../lib/viewports';

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

interface Props {
  onRegion: (region: Region) => void;
}

/** Region shortcuts on one quiet row, with the rarity key beside it. */
export function BottomBar({ onRegion }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center md:bottom-4">
      <div className="pointer-events-auto flex max-w-[min(94vw,760px)] flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-white/[0.08] bg-[#0a1020]/80 px-2 py-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <nav aria-label="Jump to region" className="flex flex-wrap justify-center gap-0.5">
          {REGIONS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => onRegion(r)}
              className="rounded-xl px-2.5 py-1.5 text-[12px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              {r.label}
            </button>
          ))}
        </nav>
        <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden />
        <ul className="hidden items-center gap-3 pr-2 md:flex" aria-label="Rarity key">
          {RARITIES.map((r) => (
            <li key={r} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span className="size-1.5 rounded-full" style={{ background: RARITY_COLOR[r] }} aria-hidden />
              {RARITY_LABEL[r]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
