import { CLUSTER_NAMES, type Cluster } from '../shared/coverage';

export interface Hub {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Major airports spread across the world. Each is polled once per refresh cycle with a 250 nm
 * radius, so the set covers most busy airspace. Aircraft between hubs are missed by design.
 */
export const HUBS: Hub[] = [
  { name: 'Atlanta', lat: 33.64, lon: -84.43 },
  { name: 'Chicago', lat: 41.98, lon: -87.9 },
  { name: 'New York', lat: 40.64, lon: -73.78 },
  { name: 'Dallas', lat: 32.9, lon: -97.04 },
  { name: 'Denver', lat: 39.86, lon: -104.67 },
  { name: 'Los Angeles', lat: 33.94, lon: -118.41 },
  { name: 'Seattle', lat: 47.45, lon: -122.31 },
  { name: 'Toronto', lat: 43.68, lon: -79.63 },
  { name: 'Mexico City', lat: 19.44, lon: -99.07 },
  { name: 'Miami', lat: 25.8, lon: -80.29 },
  { name: 'Anchorage', lat: 61.17, lon: -150.0 },
  { name: 'Honolulu', lat: 21.32, lon: -157.92 },
  { name: 'Sao Paulo', lat: -23.43, lon: -46.47 },
  { name: 'Bogota', lat: 4.7, lon: -74.15 },
  { name: 'Lima', lat: -12.02, lon: -77.11 },
  { name: 'Santiago', lat: -33.39, lon: -70.79 },
  { name: 'Buenos Aires', lat: -34.82, lon: -58.54 },
  { name: 'London', lat: 51.47, lon: -0.45 },
  { name: 'Paris', lat: 49.01, lon: 2.55 },
  { name: 'Frankfurt', lat: 50.03, lon: 8.57 },
  { name: 'Madrid', lat: 40.47, lon: -3.56 },
  { name: 'Istanbul', lat: 41.26, lon: 28.74 },
  { name: 'Moscow', lat: 55.97, lon: 37.41 },
  { name: 'Dubai', lat: 25.25, lon: 55.36 },
  { name: 'Riyadh', lat: 24.96, lon: 46.7 },
  { name: 'Tehran', lat: 35.69, lon: 51.31 },
  { name: 'Cairo', lat: 30.12, lon: 31.41 },
  { name: 'Lagos', lat: 6.58, lon: 3.32 },
  { name: 'Nairobi', lat: -1.32, lon: 36.93 },
  { name: 'Johannesburg', lat: -26.13, lon: 28.24 },
  { name: 'Delhi', lat: 28.56, lon: 77.1 },
  { name: 'Mumbai', lat: 19.09, lon: 72.87 },
  { name: 'Bengaluru', lat: 13.2, lon: 77.7 },
  { name: 'Karachi', lat: 24.9, lon: 67.16 },
  { name: 'Bangkok', lat: 13.69, lon: 100.75 },
  { name: 'Singapore', lat: 1.36, lon: 103.99 },
  { name: 'Jakarta', lat: -6.13, lon: 106.66 },
  { name: 'Manila', lat: 14.51, lon: 121.02 },
  { name: 'Hong Kong', lat: 22.31, lon: 113.92 },
  { name: 'Shanghai', lat: 31.14, lon: 121.8 },
  { name: 'Beijing', lat: 40.08, lon: 116.58 },
  { name: 'Seoul', lat: 37.46, lon: 126.44 },
  { name: 'Tokyo', lat: 35.76, lon: 140.39 },
  { name: 'Sydney', lat: -33.95, lon: 151.18 },
  { name: 'Melbourne', lat: -37.67, lon: 144.84 },
  { name: 'Auckland', lat: -37.01, lon: 174.79 },
];

export const CLUSTERS: Cluster[] = [...CLUSTER_NAMES];

/** Coarse region for a hub. Coverage is reported per cluster, so the app can say which regions are live. */
export function clusterOf(h: Hub): Cluster {
  if (h.lon < -30) return h.lat > 12 ? 'North America' : 'South America';
  if (h.lat < -10 && h.lon > 110) return 'Oceania';
  if (h.lon >= -20 && h.lon <= 60) return h.lat < 35 || h.lon > 40 ? 'Middle East & Africa' : 'Europe';
  return 'Asia';
}
