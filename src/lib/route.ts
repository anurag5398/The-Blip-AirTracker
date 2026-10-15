export interface RouteAirport {
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
}

export interface RouteInfo {
  airline: string | null;
  origin: RouteAirport;
  destination: RouteAirport;
}

const inflight = new Map<string, Promise<RouteInfo | null>>();

/**
 * Route for a callsign, fetched once per session per callsign. The server caches too; this only stops
 * the same card from asking twice. Failures are forgotten so the next open can retry.
 */
export function routeFor(callsign: string): Promise<RouteInfo | null> {
  const key = callsign.trim().toUpperCase();
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetch(`/api/route?callsign=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ route: RouteInfo | null }>) : Promise.reject(new Error(String(r.status)))))
      .then((b) => b.route)
      .catch(() => {
        inflight.delete(key);
        return null;
      });
    inflight.set(key, pending);
  }
  return pending;
}
