import { rarityOf, type Rarity } from '../../shared/aircraft';

/** How long a bounty survives being out of view (a pan or a feed hiccup) before it counts as escaped. */
export const ESCAPE_GRACE_MS = 45_000;

export interface Bounty {
  hex: string;
  callsign: string;
  type: string | null;
  rarity: Rarity;
  spottedAt: number;
  lastSeenAt: number;
}

export interface Sighting {
  hex: string;
  callsign: string;
  type: string | null;
  category: string | null;
}

export interface BountyUpdate {
  active: Bounty[];
  /** Escaped this update: out of view for longer than the grace period, never caught */
  escaped: Bounty[];
  /** Newly spotted rare-or-better aircraft */
  spotted: Bounty[];
}

/**
 * Rare-or-better aircraft become bounties. A bounty escapes only after it has been out of view
 * for ESCAPE_GRACE_MS, so panning the map doesn't count as losing a plane.
 */
export function updateBounties(
  prev: Bounty[],
  visible: Sighting[],
  caught: ReadonlySet<string>,
  now: number,
): BountyUpdate {
  const seen = new Set(visible.map((s) => s.hex));
  const active: Bounty[] = [];
  const escaped: Bounty[] = [];
  const known = new Set<string>();

  for (const b of prev) {
    if (caught.has(b.hex)) continue;
    known.add(b.hex);
    if (seen.has(b.hex)) {
      active.push({ ...b, lastSeenAt: now });
    } else if (now - b.lastSeenAt > ESCAPE_GRACE_MS) {
      escaped.push(b);
    } else {
      active.push(b);
    }
  }

  const spotted: Bounty[] = [];
  for (const s of visible) {
    if (known.has(s.hex) || caught.has(s.hex)) continue;
    const rarity = rarityOf(s.type, s.category);
    if (rarity === 'common') continue;
    const b: Bounty = { hex: s.hex, callsign: s.callsign, type: s.type, rarity, spottedAt: now, lastSeenAt: now };
    known.add(s.hex);
    spotted.push(b);
    active.push(b);
  }

  return { active, escaped, spotted };
}
