/**
 * Route lookup by callsign, from adsbdb.com (public, no key). Kept separate from the sky snapshot:
 * a route changes rarely, so one lookup per callsign per day is plenty, and misses are remembered.
 */
export interface Airport {
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
}

export interface Route {
  callsign: string;
  airline: string | null;
  origin: Airport;
  destination: Airport;
}

const POSITIVE_TTL_MS = 24 * 60 * 60_000;
const NEGATIVE_TTL_MS = 60 * 60_000;
const CALLSIGN = /^[A-Z0-9]{2,8}$/;

interface Entry {
  route: Route | null;
  at: number;
}

interface AdsbdbAirport {
  iata_code?: string;
  name?: string;
  municipality?: string;
  country_name?: string;
}

interface AdsbdbResponse {
  response?: {
    flightroute?: {
      airline?: { name?: string };
      origin?: AdsbdbAirport;
      destination?: AdsbdbAirport;
    };
  };
}

export function isValidCallsign(cs: string): boolean {
  return CALLSIGN.test(cs);
}

function toAirport(a: AdsbdbAirport | undefined): Airport | null {
  if (!a?.name) return null;
  return { iata: a.iata_code ?? null, name: a.name, city: a.municipality ?? null, country: a.country_name ?? null };
}

export class RouteCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<Route | null>>();

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async lookup(callsign: string): Promise<Route | null> {
    const hit = this.entries.get(callsign);
    if (hit && this.now() - hit.at < (hit.route ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS)) return hit.route;

    let pending = this.inflight.get(callsign);
    if (!pending) {
      pending = this.fetchRoute(callsign).then((route) => {
        this.entries.set(callsign, { route, at: this.now() });
        return route;
      });
      this.inflight.set(callsign, pending);
      void pending.finally(() => this.inflight.delete(callsign)).catch(() => undefined);
    }
    try {
      return await pending;
    } catch {
      // Upstream trouble is not "no route": don't cache it, and tell the caller nothing
      return null;
    }
  }

  private async fetchRoute(callsign: string): Promise<Route | null> {
    const res = await this.fetchImpl(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, {
      headers: { 'User-Agent': 'blip/0.1 (live radar)', Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`adsbdb ${res.status}`);
    const body = (await res.json()) as AdsbdbResponse;
    const fr = body.response?.flightroute;
    const origin = toAirport(fr?.origin);
    const destination = toAirport(fr?.destination);
    if (!origin || !destination) return null;
    return { callsign, airline: fr?.airline?.name ?? null, origin, destination };
  }
}
