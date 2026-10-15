import { describe, expect, it } from 'vitest';
import type { Aircraft } from '../../shared/aircraft';
import { inBBox } from '../../shared/geo';
import { airlineFor } from './airline';
import { projectPosition, thinForZoom, toBlips, toTrailCollection, type Blip, type Trails } from './flights';
import { simulatedSky } from './simulated';
import { matchesFilter } from './filter';

const base: Aircraft = {
  hex: '800cc7',
  callsign: 'AIC101',
  reg: null,
  type: 'A320',
  category: 'A3',
  lat: 20,
  lon: 75,
  track: 0,
  gs: 360,
  alt: 30_000,
  onGround: false,
  squawk: null,
  age: 0,
};

describe('airlineFor', () => {
  it('maps ICAO callsign prefixes and returns null for unknown operators', () => {
    expect(airlineFor('IGO399')).toBe('IndiGo');
    expect(airlineFor('BAW12')).toBe('British Airways');
    expect(airlineFor('XYZ1')).toBeNull();
  });
});

describe('projectPosition', () => {
  const blip = (over: Partial<Blip> = {}): Blip => ({ ...base, fixAt: 0, ...over });

  it('dead-reckons north for a 0° track, capped at 120 s of projection', () => {
    const [lon, lat] = projectPosition(blip(), 10_000); // 10 s at 360 kt = 1 nm = 1/60°
    expect(lon).toBeCloseTo(75, 6);
    expect(lat).toBeCloseTo(20 + 1 / 60, 6);

    const [, capped] = projectPosition(blip(), 600_000);
    expect(capped).toBeCloseTo(20 + 12 / 60, 6); // 120 s cap = 12 nm
  });

  it('does not move aircraft on the ground', () => {
    expect(projectPosition(blip({ onGround: true, track: 90 }), 60_000)).toEqual([75, 20]);
  });

  it('derives the fix time from the server-reported age', () => {
    const [blipNow] = toBlips([{ ...base, age: 4_000 }], 100_000);
    expect(blipNow.fixAt).toBe(96_000);
  });
});

describe('inBBox', () => {
  it('handles a box that crosses the antimeridian', () => {
    const box = { south: -2, north: 2, west: 175, east: -175 };
    expect(inBBox(0, 178, box)).toBe(true);
    expect(inBBox(0, -178, box)).toBe(true);
    expect(inBBox(0, 0, box)).toBe(false);
  });
});

describe('simulated sky', () => {
  it('is deterministic, clearly marked, and never uses a real ICAO hex', () => {
    const a = simulatedSky(['Europe'], 0);
    const b = simulatedSky(['Europe'], 0);
    expect(a).toEqual(b);
    expect(a.every((x) => x.simulated && x.callsign.startsWith('SIM-') && x.hex.startsWith('sim'))).toBe(true);
  });

  it('covers only the regions passed in', () => {
    const oceania = simulatedSky(['Oceania'], 0);
    expect(oceania.every((x) => x.lon > 120)).toBe(true);
  });
});

describe('matchesFilter', () => {
  it('finds a target by type code, aircraft name, or helicopter keyword', () => {
    const jumbo = { ...base, hex: 'j', type: 'A388', category: 'A5' } as Blip;
    const heli = { ...base, hex: 'h', type: 'EC35', category: 'A7' } as Blip;
    expect(matchesFilter(jumbo, 'A388')).toBe(true);
    expect(matchesFilter(jumbo, 'A380')).toBe(true);
    expect(matchesFilter(jumbo, 'A320')).toBe(false);
    expect(matchesFilter(heli, 'heli')).toBe(true);
  });
});

describe('thinForZoom', () => {
  it('keeps every rare-or-better aircraft and caps commons when zoomed out', () => {
    const commons = Array.from({ length: 200 }, (_, i) => ({ ...base, hex: `c${i}`, type: 'A320', category: 'A3', fixAt: 0 }) as Blip);
    const rare = { ...base, hex: 'r', type: 'A388', category: 'A5', fixAt: 0 } as Blip;
    const kept = thinForZoom([rare, ...commons], 2);
    expect(kept.filter((b) => b.hex === 'r')).toHaveLength(1);
    expect(kept.length).toBe(121);
    expect(thinForZoom([rare, ...commons], 6)).toHaveLength(201);
  });
});

describe('toTrailCollection', () => {
  it('does not draw a line across the antimeridian', () => {
    const trails: Trails = new Map([['x', [[179.5, 0], [-179.6, 0.1]]]]);
    const blip = { ...base, hex: 'x', lat: 0.1, lon: -179.6, gs: 0, fixAt: 0 } as Blip;
    const [feature] = toTrailCollection(trails, [blip], 0).features;
    // No single segment may contain points on both sides of the antimeridian
    const spansBoth = feature.geometry.coordinates.some(
      (seg) => seg.some((p) => p[0] > 0) && seg.some((p) => p[0] < 0),
    );
    expect(spansBoth).toBe(false);
  });
});
