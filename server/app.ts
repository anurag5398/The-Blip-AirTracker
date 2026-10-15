import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BBox } from '../shared/geo';
import type { SkyCache } from './cache';
import { isValidCallsign, type RouteCache } from './routes';
import { AircraftInfoCache, isValidHex } from './aircraftInfo';
import { validateScore, type Leaderboard } from './scores';

/** Reads a JSON body up to `limit` bytes. Returns undefined when the body is too large or not JSON. */
async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return undefined;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

/** Enough for a whole-world view; rarer aircraft are kept first when the cap bites. */
const SNAPSHOT_LIMIT = 2_500;

export interface Options {
  sky: SkyCache;
  routes: RouteCache;
  aircraftInfo: AircraftInfoCache;
  scores: Leaderboard;
  distDir?: string;
  now?: () => number;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createHandler(opts: Options) {
  const now = opts.now ?? Date.now;

  function parseBBox(url: URL): BBox | null {
    const get = (k: string) => Number(url.searchParams.get(k));
    const bbox = { south: get('s'), north: get('n'), west: get('w'), east: get('e') };
    const valid =
      [bbox.south, bbox.north, bbox.west, bbox.east].every(Number.isFinite) &&
      bbox.south >= -90 && bbox.north <= 90 && bbox.south <= bbox.north &&
      bbox.west >= -180 && bbox.east <= 180;
    return valid ? bbox : null;
  }

  function handleAircraft(url: URL, res: ServerResponse) {
    const bbox = parseBBox(url);
    if (!bbox) return json(res, 400, { error: 'invalid bbox' });
    const snap = opts.sky.snapshot(bbox, SNAPSHOT_LIMIT);
    // dataAgeMs is null until the first hub answers; the client shows "gathering" meanwhile
    return json(res, 200, { now: now(), ...snap, warming: snap.dataAgeMs === null }, 5);
  }

  async function handleRoute(url: URL, res: ServerResponse) {
    // Validate at the boundary: only plausible callsigns ever reach the upstream lookup
    const callsign = (url.searchParams.get('callsign') ?? '').trim().toUpperCase();
    if (!isValidCallsign(callsign)) return json(res, 400, { error: 'invalid callsign' });
    const route = await opts.routes.lookup(callsign);
    return json(res, 200, { route }, 3600);
  }

  async function handleScores(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'GET') return json(res, 200, { top: opts.scores.top(10) }, 15);
    if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
    const body = await readJson(req, 2_048);
    if (body === undefined) return json(res, 400, { error: 'invalid json or too large' });
    const v = validateScore(body);
    if (!v.ok) return json(res, 400, { error: v.error });
    const rank = opts.scores.submit(v.entry);
    return json(res, 200, { rank, top: opts.scores.top(10) });
  }

  async function handleAircraftInfo(url: URL, res: ServerResponse) {
    const hex = (url.searchParams.get('hex') ?? '').trim().toLowerCase();
    if (!isValidHex(hex)) return json(res, 400, { error: 'invalid hex' });
    const info = await opts.aircraftInfo.lookup(hex);
    return json(res, 200, { info }, 86_400);
  }

  function serveStatic(pathname: string, res: ServerResponse): boolean {
    if (!opts.distDir) return false;
    const root = resolve(opts.distDir);
    const file = resolve(join(root, normalize(decodeURIComponent(pathname))));
    const target = file.startsWith(root) && existsSync(file) && statSync(file).isFile() ? file : join(root, 'index.html');
    if (!existsSync(target)) return false;
    const hashed = target.includes('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(target).pipe(res);
    return true;
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/api/scores') return await handleScores(req, res);
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
      if (url.pathname === '/healthz') return json(res, 200, { ok: true });
      if (url.pathname === '/api/aircraft') return handleAircraft(url, res);
      if (url.pathname === '/api/route') return await handleRoute(url, res);
      if (url.pathname === '/api/aircraft-info') return await handleAircraftInfo(url, res);
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });
      if (serveStatic(url.pathname, res)) return;
      json(res, 404, { error: 'not found' });
    } catch {
      json(res, 500, { error: 'internal error' });
    }
  };
}

function json(res: ServerResponse, status: number, body: unknown, maxAgeSeconds = 0) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': maxAgeSeconds ? `public, max-age=${maxAgeSeconds}` : 'no-store',
  });
  res.end(JSON.stringify(body));
}
