/**
 * Registration and owner for one airframe, looked up by its ICAO 24-bit hex (adsbdb.com, public).
 * Only fetched when someone opens a card, and cached for a week: registrations almost never change.
 */
export interface AircraftInfo {
  registration: string | null;
  owner: string | null;
  manufacturer: string | null;
  icaoType: string | null;
}

const TTL_MS = 7 * 24 * 60 * 60_000;
const MISS_TTL_MS = 6 * 60 * 60_000;
const HEX = /^[0-9a-f]{6}$/;

interface Entry {
  info: AircraftInfo | null;
  at: number;
}

interface AdsbdbAircraft {
  registration?: string;
  registered_owner?: string;
  manufacturer?: string;
  icao_type?: string;
}

export function isValidHex(hex: string): boolean {
  return HEX.test(hex);
}

export class AircraftInfoCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<AircraftInfo | null>>();

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async lookup(hex: string): Promise<AircraftInfo | null> {
    const hit = this.entries.get(hex);
    if (hit && this.now() - hit.at < (hit.info ? TTL_MS : MISS_TTL_MS)) return hit.info;

    let pending = this.inflight.get(hex);
    if (!pending) {
      pending = this.fetchInfo(hex).then((info) => {
        this.entries.set(hex, { info, at: this.now() });
        return info;
      });
      this.inflight.set(hex, pending);
      void pending.finally(() => this.inflight.delete(hex)).catch(() => undefined);
    }
    try {
      return await pending;
    } catch {
      // Upstream trouble is not "unknown aircraft": don't cache it
      return null;
    }
  }

  private async fetchInfo(hex: string): Promise<AircraftInfo | null> {
    const res = await this.fetchImpl(`https://api.adsbdb.com/v0/aircraft/${hex.toUpperCase()}`, {
      headers: { 'User-Agent': 'blip/0.1 (live radar)', Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`adsbdb ${res.status}`);
    const body = (await res.json()) as { response?: { aircraft?: AdsbdbAircraft } | string };
    const a = typeof body.response === 'object' ? body.response.aircraft : undefined;
    if (!a) return null;
    return {
      registration: a.registration ?? null,
      owner: a.registered_owner ?? null,
      manufacturer: a.manufacturer ?? null,
      icaoType: a.icao_type ?? null,
    };
  }
}
