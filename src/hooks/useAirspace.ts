import { useEffect, useState } from 'react';
import type { Aircraft } from '../../shared/aircraft';
import type { BBox } from '../../shared/geo';
import { toBlips, updateTrails, type Blip, type Trails } from '../lib/flights';
import type { Coverage } from '../../shared/coverage';

/** idle: nothing requested yet · warming: server has no hub data yet · live: data flowing · degraded/offline: our API failing */
export type FeedStatus = 'idle' | 'warming' | 'live' | 'degraded' | 'offline';

// The server reads a shared snapshot, so polling it is cheap. The data itself refreshes about once a minute.
const POLL_MS = 10_000;
const RETRY_MS = 3_000;
const MAX_BACKOFF_MS = 60_000;
const OFFLINE_AFTER_FAILURES = 3;
const DEBOUNCE_MS = 300;

interface AirspaceResponse {
  aircraft: Aircraft[];
  warming: boolean;
  dataAgeMs: number | null;
  coverage: Coverage;
}

/** Live aircraft inside `bbox`, polled from our server's shared snapshot. Pauses while the tab is hidden. */
export function useAirspace(bbox: BBox | null) {
  const [blips, setBlips] = useState<Blip[]>([]);
  const [trails, setTrails] = useState<Trails>(new Map());
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [dataAgeMs, setDataAgeMs] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);

  // Keyed by value so panning that doesn't change the bbox doesn't refetch
  const key = bbox ? [bbox.south, bbox.west, bbox.north, bbox.east].map((v) => v.toFixed(2)).join(',') : null;

  useEffect(() => {
    if (!key) return;
    const [south, west, north, east] = key.split(',').map(Number);
    const box: BBox = { south, west, north, east };

    let controller = new AbortController();
    let timer = 0;
    let failures = 0;

    async function poll() {
      controller = new AbortController();
      const params = new URLSearchParams({
        s: String(box.south),
        w: String(box.west),
        n: String(box.north),
        e: String(box.east),
      });
      try {
        const res = await fetch(`/api/aircraft?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as AirspaceResponse;
        failures = 0;
        const next = toBlips(body.aircraft, Date.now());
        setBlips(next);
        setTrails((prev) => updateTrails(prev, next));
        setDataAgeMs(body.dataAgeMs);
        setCoverage(body.coverage);
        setStatus(body.warming ? 'warming' : 'live');
      } catch {
        if (controller.signal.aborted) return;
        failures += 1;
        setStatus(failures >= OFFLINE_AFTER_FAILURES ? 'offline' : 'degraded');
      }
      const delay = failures === 0 ? POLL_MS : Math.min(RETRY_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
      timer = window.setTimeout(poll, delay);
    }

    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.hidden) controller.abort();
      else void poll();
    };

    timer = window.setTimeout(poll, DEBOUNCE_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return { blips, trails, status, dataAgeMs, coverage };
}
