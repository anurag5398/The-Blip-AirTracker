import { airframeFor, CATEGORY_LABEL } from '../data/airframes';
import { squawkAlert } from '../game/rules';
import type { Blip } from '../lib/flights';
import { formatFeet, formatSpeed } from '../lib/format';

interface Props {
  blip: Blip;
  target: string;
  onLog: () => void;
  onPass: () => void;
  onClose: () => void;
}

/**
 * A contact's data tag, the way a radar screen shows it once you open a target.
 * The type is only revealed here. Log it if it matches the target, pass otherwise.
 */
export function MissionTag({ blip, target, onLog, onPass, onClose }: Props) {
  const af = airframeFor(blip.type);
  const alert = squawkAlert(blip.squawk);
  const heading = Math.round(blip.track);
  const fl = blip.alt != null ? `FL${Math.round(blip.alt / 100)}` : 'GND';

  return (
    <section
      aria-label={`Contact ${blip.callsign}`}
      className="atc-panel pointer-events-auto w-full max-w-sm font-mono text-[12px] text-phosphor"
      onKeyDown={(e) => {
        if (e.key === 'l' || e.key === 'L') onLog();
        if (e.key === 'p' || e.key === 'P') onPass();
      }}
    >
      <header className="flex items-center justify-between border-b border-phosphor/20 px-4 py-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-phosphor/70">Contact</span>
        <button type="button" onClick={onClose} className="text-phosphor/60 hover:text-phosphor" aria-label="Close contact">
          ✕
        </button>
      </header>

      <div className="px-4 py-3">
        <p className="text-2xl font-semibold tracking-tight text-phosphor">{blip.callsign}</p>
        <p className="mt-1 text-phosphor/80">
          {af?.name ?? (blip.type ? `Type ${blip.type}` : 'Type unknown')}
          {af && <span className="text-phosphor/50"> · {af.engines} eng</span>}
        </p>
        {blip.category && CATEGORY_LABEL[blip.category] && (
          <p className="mt-1 text-[11px] text-phosphor/50">{CATEGORY_LABEL[blip.category]}</p>
        )}

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-phosphor/15 pt-3">
          <Field label="ALT" value={`${fl} · ${formatFeet(blip.alt)}`} />
          <Field label="GS" value={formatSpeed(blip.gs)} />
          <Field label="HDG" value={`${heading}°`} />
          <Field label="SQWK" value={blip.squawk ?? '—'} tone={alert ? 'alert' : undefined} />
        </dl>
        {alert && <p className="mt-2 text-[11px] uppercase tracking-wider text-amber-300">{alert}</p>}
      </div>

      <div className="border-t border-phosphor/20 px-4 py-3">
        <p className="mb-3 text-[11px] text-phosphor/60">
          TARGET · <span className="text-phosphor">{target}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLog}
            className="rounded-sm border border-phosphor bg-phosphor/15 py-2.5 font-semibold uppercase tracking-wider text-phosphor transition hover:bg-phosphor/25"
          >
            Log <span className="text-phosphor/60">(L)</span>
          </button>
          <button
            type="button"
            onClick={onPass}
            className="rounded-sm border border-phosphor/30 py-2.5 uppercase tracking-wider text-phosphor/70 transition hover:border-phosphor/60 hover:text-phosphor"
          >
            Pass <span className="text-phosphor/50">(P)</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[10px] tracking-wider text-phosphor/50">{label}</dt>
      <dd className={`tabular-nums ${tone === 'alert' ? 'text-amber-300' : 'text-phosphor'}`}>{value}</dd>
    </div>
  );
}
