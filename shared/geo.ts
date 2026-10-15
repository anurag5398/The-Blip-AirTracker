export const QUERY_RADIUS_NM = 250;

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Splits a west→east span that crosses the antimeridian into two spans. */
function lonSpans(west: number, east: number): [number, number][] {
  return west <= east ? [[west, east]] : [[west, 180], [-180, east]];
}

export function inBBox(lat: number, lon: number, bbox: BBox): boolean {
  if (lat < bbox.south || lat > bbox.north) return false;
  return lonSpans(bbox.west, bbox.east).some(([w, e]) => lon >= w && lon <= e);
}
