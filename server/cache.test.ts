import { describe, expect, it } from 'vitest';
import { SkyCache } from './cache';

const RAW = (hex: string, lat: number, lon: number, extra: Record<string, unknown> = {}) => ({
  hex,
  flight: `T${hex}`,
  lat,
  lon,
  alt_baro: 30_000,
  gs: 400,
  track: 90,
  seen_pos: 2,
  ...extra,
});

interface SetupOpts {
  baseMinAgeMs?: number;
  demandMinAgeMs?: number;
}

function setup(responses: Record<string, () => Response | Promise<Response>>, opts: SetupOpts = {}) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const requests: string[] = [];
  const fetchImpl = (async (url: string) => {
    requests.push(String(url));
    const hub = Object.keys(responses).find((k) => String(url).includes(k));
    return hub ? responses[hub]() : new Response('{"ac":[]}', { status: 200 });
  }) as typeof fetch;
  const cache = new SkyCache({
    hubs: [
      { name: 'a', lat: 10, lon: 10 },
      { name: 'b', lat: 20, lon: 20 },
    ],
    adsbBase: 'https://example.test/v2',
    paceMs: 0,
    rateLimitPauseMs: 60_000,
    retentionMs: 15 * 60_000,
    baseMinAgeMs: opts.baseMinAgeMs ?? 0,
    demandMinAgeMs: opts.demandMinAgeMs ?? 0,
    demandWindowMs: 10 * 60_000,
    fetchImpl,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
  });
  return { cache, sleeps, requests, advance: (ms: number) => (t += ms) };
}

const json = (ac: unknown[]) => () => new Response(JSON.stringify({ ac }), { status: 200 });
const WORLD = { south: -90, north: 90, west: -180, east: 180 };

describe('SkyCache', () => {
  it('stores hub results and ages them by time since fetch', async () => {
    const { cache, advance } = setup({ '/lat/10/': json([RAW('abc', 10, 10)]) });
    await cache.refreshOnce();
    advance(30_000);
    const snap = cache.snapshot(WORLD, 100);
    expect(snap.aircraft).toHaveLength(1);
    // 2 s reported at fetch + 30 s since
    expect(snap.aircraft[0].age).toBe(32_000);
    expect(snap.dataAgeMs).toBe(30_000);
  });

  it('reports no data before the first successful hub', () => {
    const { cache } = setup({});
    expect(cache.snapshot(WORLD, 100)).toMatchObject({
      aircraft: [],
      total: 0,
      dataAgeMs: null,
      coverage: { ready: false, live: 0 },
    });
  });

  it('reports a cluster live once one of its hubs answers, and not ready until all are', async () => {
    const { cache } = setup({ '/lat/10/': json([]) });
    await cache.refreshOnce();
    const cov = cache.coverage();
    // Both test hubs sit in one cluster, so one live cluster is not enough
    expect(cov.live).toBe(1);
    expect(cov.ready).toBe(false);
  });

  it('filters the snapshot to the viewport', async () => {
    const { cache } = setup({ '/lat/10/': json([RAW('in', 10, 10), RAW('out', -40, 150)]) });
    await cache.refreshOnce();
    const snap = cache.snapshot({ south: 0, north: 20, west: 0, east: 20 }, 100);
    expect(snap.aircraft.map((a) => a.hex)).toEqual(['in']);
  });

  it('keeps the rarest aircraft when the limit bites', async () => {
    const { cache } = setup({
      '/lat/10/': json([
        RAW('common', 10, 10, { t: 'A320', category: 'A3' }),
        RAW('legend', 10.1, 10.1, { t: 'A388', category: 'A5' }),
      ]),
    });
    await cache.refreshOnce();
    expect(cache.snapshot(WORLD, 1).aircraft.map((a) => a.hex)).toEqual(['legend']);
  });

  it('pauses the whole loop for a minute after a 429', async () => {
    const { cache, sleeps } = setup({ '/lat/10/': () => new Response('', { status: 429 }) });
    await cache.refreshOnce();
    expect(sleeps).toContain(60_000);
  });

  it('never refetches a hub before its minimum age', async () => {
    const { cache, requests } = setup({}, { baseMinAgeMs: 300_000 });
    // Two hubs get one fetch each; further attempts must wait, not request
    for (let i = 0; i < 6; i++) await cache.refreshNext();
    expect(requests).toHaveLength(2);
  });
});
