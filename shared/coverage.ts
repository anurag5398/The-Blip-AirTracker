/** The regions the live feed is split into. The app goes fully live only when every one has fresh data. */
export const CLUSTER_NAMES = [
  'North America',
  'South America',
  'Europe',
  'Middle East & Africa',
  'Asia',
  'Oceania',
] as const;

export type Cluster = (typeof CLUSTER_NAMES)[number];

/** Rough centre of each region as [lon, lat], used to place simulated traffic while it is dark */
export const CLUSTER_CENTER: Record<Cluster, [number, number]> = {
  'North America': [-95, 38],
  'South America': [-60, -15],
  Europe: [10, 50],
  'Middle East & Africa': [25, 10],
  Asia: [100, 30],
  Oceania: [145, -28],
};

export interface Coverage {
  /** True only when every cluster has a fresh hub */
  ready: boolean;
  /** Clusters with at least one fresh hub, of the total */
  live: number;
  total: number;
  clusters: Record<Cluster, boolean>;
}
