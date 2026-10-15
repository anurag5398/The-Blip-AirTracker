import { airframeFor } from '../data/airframes';
import type { Blip } from './flights';

/**
 * Search matches a callsign, an ICAO type code, or the aircraft's name ("A380", "747", "Gulfstream").
 * "HELI" or "HELICOPTER" matches rotorcraft. This is how you find a shift target on the map.
 */
export function matchesFilter(b: Blip, query: string): boolean {
  const q = query.trim().toUpperCase();
  if (!q) return true;
  if (q === 'HELI' || q === 'HELICOPTER') return b.category === 'A7';
  if (b.callsign.toUpperCase().startsWith(q)) return true;
  if (b.type?.toUpperCase().includes(q)) return true;
  const name = airframeFor(b.type)?.name.toUpperCase() ?? '';
  return name.includes(q);
}
