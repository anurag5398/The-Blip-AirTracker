export interface AircraftIdentity {
  registration: string | null;
  owner: string | null;
  manufacturer: string | null;
  icaoType: string | null;
}

const inflight = new Map<string, Promise<AircraftIdentity | null>>();

/** Registration and owner for an airframe, fetched once per session. Failures are forgotten so a reopen retries. */
export function identityFor(hex: string): Promise<AircraftIdentity | null> {
  const key = hex.trim().toLowerCase();
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetch(`/api/aircraft-info?hex=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ info: AircraftIdentity | null }>) : Promise.reject(new Error(String(r.status)))))
      .then((b) => b.info)
      .catch(() => {
        inflight.delete(key);
        return null;
      });
    inflight.set(key, pending);
  }
  return pending;
}
