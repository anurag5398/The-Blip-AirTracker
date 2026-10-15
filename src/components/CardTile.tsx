import type { Card } from '../game/cards';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/flights';

interface Props {
  card: Card;
  onOpen?: (card: Card) => void;
  size?: 'sm' | 'lg';
}

const FRAME: Record<Card['rarity'], string> = {
  common: 'from-teal-400/25 via-slate-900 to-slate-950',
  rare: 'from-sky-400/35 via-indigo-950 to-slate-950',
  epic: 'from-violet-400/40 via-fuchsia-950/60 to-slate-950',
  legendary: 'from-amber-300/45 via-orange-950/60 to-slate-950',
};

/** A collectible card. Foil cards get a moving holographic sheen. Everything shown comes from the flight itself. */
export function CardTile({ card, onOpen, size = 'sm' }: Props) {
  const color = RARITY_COLOR[card.rarity];
  const title = card.airframe?.name ?? (card.typeCode ? `Type ${card.typeCode}` : 'Unknown aircraft');
  const body = (
    <>
      <div className={`absolute inset-0 bg-gradient-to-b ${FRAME[card.rarity]}`} aria-hidden />
      {card.foil && <div className="foil absolute inset-0" aria-hidden />}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} aria-hidden />

      <div className="relative flex h-full flex-col p-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest"
            style={{ color, background: `${color}22` }}
          >
            {RARITY_LABEL[card.rarity]}
            {card.foil && ' · Foil'}
          </span>
          <span className="truncate font-mono text-[10px] text-slate-400">{card.callsign}</span>
        </div>

        <div className="relative mt-2 grid flex-1 place-items-center">
          <div className="absolute size-24 rounded-full blur-2xl" style={{ background: `${color}33` }} aria-hidden />
          <Silhouette kind={card.categoryLabel?.startsWith('Rotorcraft') ? 'heli' : 'plane'} color={color} />
        </div>

        <div>
          <p className={`truncate font-display font-semibold leading-tight text-white ${size === 'lg' ? 'text-xl' : 'text-sm'}`}>{title}</p>
          <p className="truncate text-[11px] text-slate-400">
            {card.airline ?? 'Unknown operator'}
            {card.reg && <span className="font-mono text-slate-500"> · {card.reg}</span>}
          </p>
        </div>

        <dl className="mt-2 space-y-1">
          <StatBar label="SPD" value={card.stats.speed} color={color} />
          <StatBar label="ALT" value={card.stats.altitude} color={color} />
          <StatBar label="RAR" value={card.stats.rarity} color={color} />
        </dl>
      </div>
    </>
  );

  const shell = `relative aspect-[5/7] w-full overflow-hidden rounded-2xl border bg-slate-950 text-left shadow-xl`;
  const style = { borderColor: `${color}55`, boxShadow: `0 10px 30px -12px ${color}66` };

  if (!onOpen) {
    return (
      <div className={shell} style={style} aria-label={`${title}, ${RARITY_LABEL[card.rarity]}`}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className={`${shell} transition duration-200 hover:-translate-y-1 hover:scale-[1.02] focus-visible:-translate-y-1`}
      style={style}
      aria-label={`Open card: ${title}, ${RARITY_LABEL[card.rarity]}`}
    >
      {body}
    </button>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-7 font-mono text-[9px] text-slate-500">{label}</dt>
      <dd className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </dd>
    </div>
  );
}

function Silhouette({ kind, color }: { kind: 'plane' | 'heli'; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="relative size-11 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] sm:size-14" aria-hidden>
      {kind === 'heli' ? (
        <g fill={color}>
          <ellipse cx="12" cy="13" rx="3.4" ry="6" />
          <rect x="11" y="2" width="2" height="20" rx="1" />
          <rect x="2" y="11.5" width="20" height="2" rx="1" opacity="0.7" />
        </g>
      ) : (
        <path
          fill={color}
          d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        />
      )}
    </svg>
  );
}
