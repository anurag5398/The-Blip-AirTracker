/** Rough continent guess from a coordinate. Boxes are approximate by design: this drives a game badge, not geography. */
export function regionOf(lat: number, lon: number): string {
  if (lon < -30) return lat > 12 ? 'North America' : 'South America';
  if (lat < -10 && lon > 110) return 'Oceania';
  if (lat < 35 && lon >= -20 && lon <= 55) return 'Africa';
  if (lat >= 35 && lon <= 45) return 'Europe';
  return 'Asia';
}
