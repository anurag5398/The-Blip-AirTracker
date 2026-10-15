export interface Region {
  label: string;
  center: [number, number];
  zoom: number;
}

/** One-tap camera presets. Zoom levels are chosen so each region has traffic in view. */
export const REGIONS: Region[] = [
  { label: 'World', center: [10, 20], zoom: 1.6 },
  { label: 'Europe', center: [12, 46], zoom: 4.2 },
  { label: 'North America', center: [-98, 39], zoom: 3.6 },
  { label: 'India', center: [79, 22], zoom: 4.4 },
  { label: 'East Asia', center: [116, 33], zoom: 3.8 },
  { label: 'Middle East', center: [50, 27], zoom: 4.2 },
  { label: 'Australia', center: [134, -25], zoom: 3.8 },
];
