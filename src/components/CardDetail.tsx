import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Card } from '../game/cards';
import { specsFor } from '../data/specs';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/flights';
import { identityFor, type AircraftIdentity } from '../lib/aircraftInfo';
import { routeFor, type RouteInfo } from '../lib/route';
import { CardTile } from './CardTile';

const WHY_RARE: Record<Card['rarity'], string> = {
  common: 'Common: most of the sky. Narrowbody airliners, regional jets and turboprops.',
  rare: 'Rare: business jets, helicopters and fighter-class aircraft are seen far less often.',
  epic: 'Epic: widebody airliners, the big twin- and four-engine jets used on long-haul routes.',
  legendary: 'Legendary: the super-heavy jumbos. The A380 and the 747 family.',
};

const STAT_HELP = {
  speed: 'Ground speed. 100 = 600 kt or faster.',
  altitude: 'Altitude. 100 = 45,000 ft or higher.',
  rarity: 'Rarity. Set by the aircraft type.',
} as const;

interface Props {
  card: Card;
  /** Your own history, counted from your wallet */
  history: { sameType: number; sameAirline: number; total: number };
  onClose: () => void;
}

/**
 * The card, in two levels. The summary is what you see first. "Full specs" opens the detail:
 * dimensions, seating, engines, registration and owner, your history, the route, and the facts.
 */
export function CardDetail({ card, history, onClose }: Props) {
  const color = RARITY_COLOR[card.rarity];
  const af = card.airframe;
  const specs = specsFor(card.typeCode);
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null | 'loading'>('loading');
  const [identity, setIdentity] = useState<AircraftIdentity | null | 'loading'>('loading');

  // Route and identity are only fetched once the detail is opened: most cards are never expanded
  useEffect(() => {
    if (!open) return;
    let live = true;
    routeFor(card.callsign).then((r) => live && setRoute(r));
    identityFor(card.hex).then((i) => live && setIdentity(i));
    return () => {
      live = false;
    };
  }, [open, card.callsign, card.hex]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={`${af?.name ?? card.typeCode ?? 'Aircraft'} card`}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl border border-white/10 bg-ink/95 p-5 shadow-2xl md:max-w-3xl md:flex-row md:gap-6 md:rounded-3xl md:p-6"
      >
        <div className="mx-auto w-48 shrink-0 md:mx-0 md:w-56">
          <CardTile card={card} size="lg" />
        </div>

        <div className="mt-5 min-w-0 flex-1 md:mt-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
                {RARITY_LABEL[card.rarity]}
                {card.foil && ' · Foil'}
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white">{af?.name ?? `Type ${card.typeCode ?? '?'}`}</h2>
              <p className="text-sm text-slate-400">
                {card.airline ?? 'Unknown operator'} · <span className="font-mono">{card.callsign}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close card" className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Level 1: compressed. Always visible. */}
          <dl className="mt-5 grid grid-cols-3 gap-2" aria-label="Summary">
            <Chip label="Engines" value={af ? String(af.engines) : '—'} />
            <Chip label="Seats" value={specs?.seats ?? '—'} />
            <Chip label="Length" value={specs ? `${specs.lengthM} m` : '—'} />
          </dl>
          {af && <p className="mt-4 text-sm leading-relaxed text-slate-300">{af.fact}</p>}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-display text-sm text-white transition hover:bg-white/[0.06]"
          >
            {open ? 'Hide full specs' : 'Full specs, identity and route'}
            <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {/* Level 2: detailed. */}
          <AnimatePresence initial={false}>
            {open && (
              <motion.div key="detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Section title="Specifications">
                  <Row label="Length" value={specs ? `${specs.lengthM} m` : 'Not in our reference'} />
                  <Row label="Wingspan" value={specs ? `${specs.wingspanM} m` : 'Not in our reference'} />
                  <Row label="Typical seats" value={specs?.seats ?? 'Not in our reference'} />
                  <Row label="Engines" value={af ? `${af.engines} · ${specs?.engines ?? 'family not in our reference'}` : '—'} />
                  <Row label="Manufacturer" value={af?.maker ?? 'Unknown'} />
                  <Row label="Built" value="Not in our data" muted />
                </Section>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Dimensions are approximate published figures. Seats are a typical range; every airline configures its cabin differently.
                </p>

                <Section title="Identity">
                  {identity === 'loading' ? (
                    <p className="text-sm text-slate-500">Looking up the registration…</p>
                  ) : identity ? (
                    <>
                      <Row label="Registration" value={identity.registration ?? card.reg ?? 'Not published'} mono />
                      <Row label="Registered owner" value={identity.owner ?? 'Not published'} />
                    </>
                  ) : (
                    <Row label="Registration" value={card.reg ?? 'Not available right now'} mono />
                  )}
                </Section>

                <Section title="Route">
                  {route === 'loading' ? (
                    <p className="text-sm text-slate-500">Looking up the route…</p>
                  ) : route ? (
                    <div className="flex items-center justify-between gap-3">
                      <AirportLabel a={route.origin} />
                      <span className="font-mono text-slate-500" aria-hidden>→</span>
                      <AirportLabel a={route.destination} align="right" />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No published route. Many charter and cargo flights don't publish one.</p>
                  )}
                </Section>

                <Section title="Your history">
                  <Row label={`Catches of this type`} value={String(history.sameType)} mono />
                  <Row label={`Catches from ${card.airline ?? 'this operator'}`} value={String(history.sameAirline)} mono />
                  <Row label="Total catches" value={String(history.total)} mono />
                </Section>

                <Section title="Stats">
                  <ul className="space-y-3">
                    {(['speed', 'altitude', 'rarity'] as const).map((k) => (
                      <li key={k}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize text-slate-300">{k}</span>
                          <span className="font-mono tabular-nums text-slate-400">{card.stats[k]}</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${card.stats[k]}%`, background: color }} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{STAT_HELP[k]}</p>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="About this flight">
                  <ul className="space-y-2">
                    {card.facts.map((f) => (
                      <li key={f} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                        <span className="mt-2 size-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </Section>

                <p className="mt-5 rounded-2xl bg-white/[0.03] p-4 text-xs leading-relaxed text-slate-500">{WHY_RARE[card.rarity]}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </motion.div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm tabular-nums text-white">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5" aria-label={title}>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">{title}</h3>
      <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] px-4">{children}</div>
    </section>
  );
}

function Row({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-right text-sm ${mono ? 'font-mono tabular-nums' : ''} ${muted ? 'text-slate-500' : 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function AirportLabel({ a, align = 'left' }: { a: RouteInfo['origin']; align?: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 flex-1 ${align === 'right' ? 'text-right' : ''}`}>
      <p className="font-mono text-xl font-semibold text-white">{a.iata ?? '—'}</p>
      <p className="truncate text-[11px] text-slate-400">{a.name}</p>
      {a.city && <p className="truncate text-[10px] text-slate-600">{a.city}{a.country ? `, ${a.country}` : ''}</p>}
    </div>
  );
}
