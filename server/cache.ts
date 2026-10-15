import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeAircraft, rarityOf, type Aircraft, type RawAircraft } from '../shared/aircraft';
import { inBBox, QUERY_RADIUS_NM, type BBox } from '../shared/geo';
import { CLUSTERS, clusterOf, type Hub } from './hubs';
import type { Cluster, Coverage } from '../shared/coverage';

/**
 * Shared sky snapshot, built for the fewest possible upstream requests.
 *
 * - One loop, one request at a time, paced.
 * - A hub is refetched only once it is older than its minimum age: `baseMinAgeMs` normally,
 *   `demandMinAgeMs` when a viewport is covering it. Nothing is fetched just because a browser asked.
 * - The snapshot is saved to disk, so a restart serves yesterday's sky instead of re-fetching everything.
 *
 * Browser requests only read this object. They never call upstream.
 */
export interface SkyCacheOptions {
  hubs: Hub[];
  adsbBase: string;
  paceMs: number;
  rateLimitPauseMs: number;
  retentionMs: number;
  baseMinAgeMs: number;
  demandMinAgeMs: number;
  /** Hubs wanted by a viewport in the last this-many ms count as demanded. */
  demandWindowMs: number;
  /** Where to save the snapshot. Omit to keep it in memory only. */
  persistPath?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface Stored {
  aircraft: Aircraft;
  fetchedAt: number;
}

export interface Snapshot {
  aircraft: Aircraft[];
  total: number;
  /** ms since the last successful hub fetch, or null before the first one. */
  dataAgeMs: number | null;
  coverage: Coverage;
}

export type { Coverage } from '../shared/coverage';

interface Persisted {
  savedAt: number;
  lastSuccessAt: number | null;
  lastFetchedAt: Record<string, number>;
  lastSuccessByHub?: Record<string, number>;
  entries: [string, Stored][];
}

const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
const HUB_REACH_LAT = 5;
const HUB_REACH_LON = 6;
const PERSIST_EVERY_MS = 60_000;
/** A cluster counts as live if one of its hubs has answered within this window */
const COVERAGE_FRESH_MS = 10 * 60_000;
const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class UpstreamError extends Error {
  constructor(readonly status: number) {
    super(`upstream ${status}`);
  }
}

export class SkyCache {
  private readonly byHex = new Map<string, Stored>();
  private readonly lastFetchedAt = new Map<string, number>();
  private readonly lastSuccessByHub = new Map<string, number>();
  private readonly wantedAt = new Map<string, number>();
  private lastSuccessAt: number | null = null;
  private pausedUntil = 0;
  private lastPersistAt = 0;
  private running = false;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: SkyCacheOptions) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? sleepMs;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.load();
  }

  /** Runs the refresh loop until stop() is called. */
  start(): void {
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
    this.persist();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      await this.refreshNext();
      if (this.now() - this.lastPersistAt > PERSIST_EVERY_MS) this.persist();
      await this.sleep(this.opts.paceMs);
    }
  }

  /**
   * Refreshes the most deserving hub, or waits if none is due yet. A 429 pauses the whole loop.
   */
  async refreshNext(): Promise<void> {
    const wait = this.pausedUntil - this.now();
    if (wait > 0) await this.sleep(wait);

    const hub = this.pickHub();
    const minAge = this.minAgeFor(hub);
    const age = this.now() - (this.lastFetchedAt.get(hub.name) ?? 0);
    if (age < minAge) {
      // Nothing is due: sleep until the stalest hub is, without ever requesting early
      await this.sleep(Math.min(minAge - age, 5_000));
      return;
    }

    try {
      await this.fetchHub(hub);
    } catch (err) {
      console.warn(`[sky] ${hub.name}: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof UpstreamError && err.status === 429) {
        this.pausedUntil = this.now() + this.opts.rateLimitPauseMs;
      }
    }
    this.prune();
  }

  /** Test helper: one refresh attempt per hub, no pacing. */
  async refreshOnce(): Promise<void> {
    for (let i = 0; i < this.opts.hubs.length; i++) {
      await this.refreshNext();
    }
  }

  private isDemanded(h: Hub): boolean {
    return (this.wantedAt.get(h.name) ?? 0) >= this.now() - this.opts.demandWindowMs;
  }

  private minAgeFor(h: Hub): number {
    return this.isDemanded(h) ? this.opts.demandMinAgeMs : this.opts.baseMinAgeMs;
  }

  /** Demanded hubs first, then the one fetched longest ago. */
  private pickHub(): Hub {
    const fetched = (h: Hub) => this.lastFetchedAt.get(h.name) ?? 0;
    const liveClusters = this.liveClusters();
    // Until every region is live, a hub in a dark cluster outranks one in a lit cluster
    const lit = (h: Hub) => (liveClusters.has(clusterOf(h)) ? 1 : 0);
    return [...this.opts.hubs].sort((a, b) => {
      const da = this.isDemanded(a) ? 1 : 0;
      const db = this.isDemanded(b) ? 1 : 0;
      return db - da || lit(a) - lit(b) || fetched(a) - fetched(b);
    })[0];
  }

  private liveClusters(): Set<Cluster> {
    const now = this.now();
    const live = new Set<Cluster>();
    for (const h of this.opts.hubs) {
      const t = this.lastSuccessByHub.get(h.name);
      if (t !== undefined && now - t < COVERAGE_FRESH_MS) live.add(clusterOf(h));
    }
    return live;
  }

  /** Which regions the snapshot can currently speak for. The app uses this to decide when to go live. */
  coverage(): Coverage {
    const live = this.liveClusters();
    const clusters = Object.fromEntries(CLUSTERS.map((c) => [c, live.has(c)])) as Record<Cluster, boolean>;
    return { ready: live.size === CLUSTERS.length, live: live.size, total: CLUSTERS.length, clusters };
  }

  private async fetchHub(hub: Hub): Promise<void> {
    const url = `${this.opts.adsbBase}/lat/${hub.lat}/lon/${hub.lon}/dist/${QUERY_RADIUS_NM}`;
    this.lastFetchedAt.set(hub.name, this.now());
    // adsb.lol rejects requests without an identifying User-Agent (403)
    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': 'blip/0.1 (live radar)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new UpstreamError(res.status);
    const body = (await res.json()) as { ac?: RawAircraft[] };
    const fetchedAt = this.now();
    for (const raw of body.ac ?? []) {
      const a = normalizeAircraft(raw, 0);
      if (a) this.byHex.set(a.hex, { aircraft: a, fetchedAt });
    }
    this.lastSuccessAt = fetchedAt;
    this.lastSuccessByHub.set(hub.name, fetchedAt);
  }

  private prune(): void {
    const cutoff = this.now() - this.opts.retentionMs;
    for (const [hex, s] of this.byHex) {
      if (s.fetchedAt < cutoff) this.byHex.delete(hex);
    }
  }

  /** Aircraft inside `bbox`, most valuable first (rarity, then altitude), capped at `limit`. Also marks nearby hubs as demanded. */
  snapshot(bbox: BBox, limit: number): Snapshot {
    const now = this.now();
    this.markWanted(bbox, now);
    const rows: Aircraft[] = [];
    for (const { aircraft, fetchedAt } of this.byHex.values()) {
      if (!inBBox(aircraft.lat, aircraft.lon, bbox)) continue;
      // Age = age at fetch time plus time since the fetch, so the client can place the fix in time
      rows.push({ ...aircraft, age: aircraft.age + (now - fetchedAt) });
    }
    rows.sort(
      (a, b) =>
        RARITY_RANK[rarityOf(b.type, b.category)] - RARITY_RANK[rarityOf(a.type, a.category)] ||
        (b.alt ?? 0) - (a.alt ?? 0),
    );
    return {
      aircraft: rows.slice(0, limit),
      total: rows.length,
      dataAgeMs: this.lastSuccessAt === null ? null : now - this.lastSuccessAt,
      coverage: this.coverage(),
    };
  }

  private markWanted(bbox: BBox, now: number): void {
    const reach: BBox = {
      south: bbox.south - HUB_REACH_LAT,
      north: bbox.north + HUB_REACH_LAT,
      west: bbox.west - HUB_REACH_LON,
      east: bbox.east + HUB_REACH_LON,
    };
    for (const h of this.opts.hubs) {
      if (inBBox(h.lat, h.lon, reach)) this.wantedAt.set(h.name, now);
    }
  }

  /** A failed save must never stop the refresh loop. The sky is still served from memory. */
  private persist(): void {
    try {
      this.writeSnapshot();
    } catch (err) {
      console.warn(`[sky] could not save snapshot: ${String(err)}`);
    }
  }

  private writeSnapshot(): void {
    if (!this.opts.persistPath) return;
    this.lastPersistAt = this.now();
    const data: Persisted = {
      savedAt: this.lastPersistAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFetchedAt: Object.fromEntries(this.lastFetchedAt),
      lastSuccessByHub: Object.fromEntries(this.lastSuccessByHub),
      entries: [...this.byHex.entries()],
    };
    const tmp = `${this.opts.persistPath}.tmp`;
    mkdirSync(dirname(this.opts.persistPath), { recursive: true });
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, this.opts.persistPath); // atomic: a crash mid-write never leaves a torn file
  }

  private load(): void {
    const path = this.opts.persistPath;
    if (!path || !existsSync(path)) return;
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as Persisted;
      this.lastSuccessAt = data.lastSuccessAt;
      for (const [hub, t] of Object.entries(data.lastFetchedAt)) this.lastFetchedAt.set(hub, t);
      for (const [hub, t] of Object.entries(data.lastSuccessByHub ?? {})) this.lastSuccessByHub.set(hub, t);
      for (const [hex, s] of data.entries) this.byHex.set(hex, s);
      this.prune();
      console.info(`[sky] restored ${this.byHex.size} aircraft from ${path}`);
    } catch (err) {
      // A corrupt snapshot is not worth crashing over: start cold
      console.warn(`[sky] ignoring unreadable snapshot: ${String(err)}`);
    }
  }
}
