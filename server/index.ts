import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHandler } from './app';
import { SkyCache } from './cache';
import { HUBS } from './hubs';
import { RouteCache } from './routes';
import { AircraftInfoCache } from './aircraftInfo';
import { Leaderboard } from './scores';

const port = Number(process.env.PORT ?? 8787);

// Upstream budget: adsb.lol 429s after a handful of quick requests, and a 429 pauses everything.
// Idle hubs refresh every 5 minutes; a hub a viewer is covering refreshes every 2. One request per 8 s.
const sky = new SkyCache({
  hubs: HUBS,
  adsbBase: process.env.ADSB_BASE ?? 'https://api.adsb.lol/v2',
  paceMs: 8_000,
  rateLimitPauseMs: 90_000,
  retentionMs: 15 * 60_000,
  baseMinAgeMs: 5 * 60_000,
  demandMinAgeMs: 2 * 60_000,
  demandWindowMs: 10 * 60_000,
  persistPath: fileURLToPath(new URL('./data/snapshot.json', import.meta.url)),
});
sky.start();

const server = createServer(
  createHandler({
    sky,
    routes: new RouteCache(),
    aircraftInfo: new AircraftInfoCache(),
    scores: new Leaderboard(fileURLToPath(new URL('./data/scores.json', import.meta.url))),
    distDir: fileURLToPath(new URL('../dist', import.meta.url)),
  }),
);
server.listen(port, () => {
  console.log(`blip listening on http://localhost:${port}`);
});

// Save the snapshot on the way out so a restart keeps the sky we already paid for
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    sky.stop();
    server.close(() => process.exit(0));
  });
}
