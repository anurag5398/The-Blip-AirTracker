import type { Feature, FeatureCollection, MultiLineString, Point } from 'geojson';
import { rarityOf, type Aircraft, type Rarity } from '../../shared/aircraft';
import { squawkAlert } from '../game/rules';

/** An aircraft pinned to the local clock: `fixAt` is when its last position was actually observed. */
export interface Blip extends Aircraft {
  fixAt: number;
  /** Placeholder traffic shown in regions whose live data is still warming up. Never catchable. */
  simulated?: boolean;
}

export type BlipKind = 'plane' | 'heli';

export interface BlipProperties {
  hex: string;
  track: number;
  rarity: Rarity;
  kind: BlipKind;
  alert: boolean;
  onGround: boolean;
  selected: boolean;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#5eead4',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

export const ALERT_COLOR = '#f43f5e';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// Dead-reckoning cap. The feed is deliberately delayed up to ~1 min, so extrapolate across that gap
const MAX_PROJECTION_MS = 120_000;
const TRAIL_POINTS = 14;

/** Common aircraft shown at each zoom. Rare-or-better always show, so the map stays readable when zoomed out. */
export function commonCapForZoom(zoom: number): number {
  if (zoom < 4) return 120;
  if (zoom < 5) return 250;
  if (zoom < 6) return 700;
  return Infinity;
}

/** Blips are already ordered rarest-first, so capping commons keeps the interesting planes. */
export function thinForZoom(blips: Blip[], zoom: number): Blip[] {
  const cap = commonCapForZoom(zoom);
  let commons = 0;
  return blips.filter((b) => {
    if (rarityOf(b.type, b.category) !== 'common') return true;
    if (commons >= cap) return false;
    commons++;
    return true;
  });
}

export function toBlips(aircraft: Aircraft[], receivedAt: number): Blip[] {
  return aircraft.map((a) => ({ ...a, fixAt: receivedAt - a.age }));
}

/** Extrapolates from the last fix using ground speed and track. Lat/lon are not moved on the ground. */
export function projectPosition(b: Blip, now: number): [number, number] {
  if (b.onGround || !b.gs) return [b.lon, b.lat];
  const elapsedMs = Math.min(Math.max(0, now - b.fixAt), MAX_PROJECTION_MS);
  const distanceNm = b.gs * (elapsedMs / 3_600_000);
  const rad = (b.track * Math.PI) / 180;
  const dLat = (distanceNm * Math.cos(rad)) / 60;
  const dLon = (distanceNm * Math.sin(rad)) / (60 * Math.cos((b.lat * Math.PI) / 180));
  return [b.lon + dLon, b.lat + dLat];
}

/**
 * Map features for the blips. When `masked` (identify-the-sky missions), every contact draws the same:
 * no rarity colour, no helicopter glyph, no emergency ring. The type is only shown in the contact tag.
 */
export function toFeatureCollection(
  blips: Blip[],
  now: number,
  selectedHex: string | null,
  masked = false,
): FeatureCollection<Point, BlipProperties> {
  return {
    type: 'FeatureCollection',
    features: blips.map(
      (b): Feature<Point, BlipProperties> => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: projectPosition(b, now) },
        properties: {
          hex: b.hex,
          track: b.track,
          rarity: masked ? 'common' : rarityOf(b.type, b.category),
          kind: !masked && b.category === 'A7' ? 'heli' : 'plane',
          alert: !masked && squawkAlert(b.squawk) !== null,
          onGround: b.onGround,
          selected: b.hex === selectedHex,
        },
      }),
    ),
  };
}

/** Contrail history: the last fixes seen per aircraft, appended only when a new fix arrives. */
export type Trails = Map<string, [number, number][]>;

export function updateTrails(prev: Trails, blips: Blip[]): Trails {
  const next: Trails = new Map();
  for (const b of blips) {
    const pts = prev.get(b.hex) ?? [];
    const last = pts[pts.length - 1];
    const fresh = !last || last[0] !== b.lon || last[1] !== b.lat;
    next.set(b.hex, fresh ? [...pts, [b.lon, b.lat] as [number, number]].slice(-TRAIL_POINTS) : pts);
  }
  return next;
}

/**
 * Trails drawn from their fix history up to the aircraft's projected head, so they stay attached
 * while moving. A jump over the antimeridian (|Δlon| > 180) starts a new segment instead of drawing
 * a line straight across the globe.
 */
export function toTrailCollection(
  trails: Trails,
  blips: Blip[],
  now: number,
): FeatureCollection<MultiLineString, { rarity: Rarity }> {
  const byHex = new Map(blips.map((b) => [b.hex, b]));
  const features: Feature<MultiLineString, { rarity: Rarity }>[] = [];
  for (const [hex, pts] of trails) {
    const b = byHex.get(hex);
    if (!b || pts.length < 2) continue;
    const path = [...pts, projectPosition(b, now)];
    const segments: [number, number][][] = [[path[0]]];
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      if (Math.abs(cur[0] - prev[0]) > 180) segments.push([]);
      segments[segments.length - 1].push(cur);
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: segments.filter((s) => s.length > 1) },
      properties: { rarity: rarityOf(b.type, b.category) },
    });
  }
  return { type: 'FeatureCollection', features };
}
