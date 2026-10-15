import { describe, expect, it } from 'vitest';
import { isValidCallsign, RouteCache } from './routes';

const LHR_JFK = {
  response: {
    flightroute: {
      airline: { name: 'British Airways' },
      origin: { iata_code: 'LHR', name: 'London Heathrow Airport', municipality: 'London', country_name: 'United Kingdom' },
      destination: { iata_code: 'JFK', name: 'John F. Kennedy International Airport', municipality: 'New York', country_name: 'United States' },
    },
  },
};

describe('RouteCache', () => {
  it('parses origin and destination and caches the route', async () => {
    let calls = 0;
    const cache = new RouteCache(
      (async () => {
        calls++;
        return new Response(JSON.stringify(LHR_JFK), { status: 200 });
      }) as typeof fetch,
    );
    const route = await cache.lookup('BAW117');
    expect(route?.origin.iata).toBe('LHR');
    expect(route?.destination.name).toContain('Kennedy');
    await cache.lookup('BAW117');
    expect(calls).toBe(1);
  });

  it('remembers a miss so unknown callsigns are not re-asked every poll', async () => {
    let calls = 0;
    const cache = new RouteCache(
      (async () => {
        calls++;
        return new Response('{}', { status: 404 });
      }) as typeof fetch,
    );
    expect(await cache.lookup('XYZ999')).toBeNull();
    expect(await cache.lookup('XYZ999')).toBeNull();
    expect(calls).toBe(1);
  });

  it('does not cache upstream errors, so a later request can succeed', async () => {
    let calls = 0;
    const cache = new RouteCache(
      (async () => {
        calls++;
        if (calls === 1) return new Response('', { status: 500 });
        return new Response(JSON.stringify(LHR_JFK), { status: 200 });
      }) as typeof fetch,
    );
    expect(await cache.lookup('BAW117')).toBeNull();
    expect((await cache.lookup('BAW117'))?.origin.iata).toBe('LHR');
    expect(calls).toBe(2);
  });
});

describe('isValidCallsign', () => {
  it('accepts plausible callsigns and rejects anything else', () => {
    expect(isValidCallsign('BAW117')).toBe(true);
    expect(isValidCallsign('N333MB')).toBe(true);
    expect(isValidCallsign('../etc')).toBe(false);
    expect(isValidCallsign('')).toBe(false);
  });
});
