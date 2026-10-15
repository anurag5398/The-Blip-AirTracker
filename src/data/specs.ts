/**
 * Approximate published specifications for common types. Dimensions are rounded manufacturer figures.
 * Seating is a typical range: each airline configures its cabin differently. Shown in the app with that caveat.
 */
export interface Specs {
  lengthM: number;
  wingspanM: number;
  seats: string;
  engines: string;
}

export const SPECS: Record<string, Specs> = {
  A320: { lengthM: 37.6, wingspanM: 35.8, seats: '150–180', engines: 'CFM56 or IAE V2500' },
  A20N: { lengthM: 37.6, wingspanM: 35.8, seats: '150–185', engines: 'CFM LEAP-1A or Pratt & Whitney PW1100G' },
  A321: { lengthM: 44.5, wingspanM: 35.8, seats: '185–220', engines: 'CFM56 or IAE V2500' },
  A21N: { lengthM: 44.5, wingspanM: 35.8, seats: '185–220', engines: 'CFM LEAP-1A or Pratt & Whitney PW1100G' },
  A333: { lengthM: 63.7, wingspanM: 60.3, seats: '250–300', engines: 'Trent 700, CF6-80E or PW4000' },
  A359: { lengthM: 66.8, wingspanM: 64.8, seats: '280–350', engines: 'Rolls-Royce Trent XWB' },
  A35K: { lengthM: 73.8, wingspanM: 64.8, seats: '320–370', engines: 'Rolls-Royce Trent XWB-97' },
  A388: { lengthM: 72.7, wingspanM: 79.8, seats: '480–550', engines: 'Rolls-Royce Trent 900 or Engine Alliance GP7200' },
  B738: { lengthM: 39.5, wingspanM: 35.8, seats: '160–189', engines: 'CFM56-7B' },
  B38M: { lengthM: 39.5, wingspanM: 35.9, seats: '162–178', engines: 'CFM LEAP-1B' },
  B744: { lengthM: 70.7, wingspanM: 64.4, seats: '400–450', engines: 'GE CF6-80C2, PW4000 or Rolls-Royce RB211' },
  B772: { lengthM: 63.7, wingspanM: 60.9, seats: '300–350', engines: 'GE90, Trent 800 or PW4000' },
  B77W: { lengthM: 73.9, wingspanM: 64.8, seats: '350–400', engines: 'GE90-115B or Rolls-Royce Trent 800' },
  B788: { lengthM: 56.7, wingspanM: 60.1, seats: '240–290', engines: 'GE GEnx or Rolls-Royce Trent 1000' },
  B789: { lengthM: 62.8, wingspanM: 60.1, seats: '260–300', engines: 'GE GEnx or Rolls-Royce Trent 1000' },
  E190: { lengthM: 36.2, wingspanM: 28.7, seats: '96–114', engines: 'GE CF34-10E' },
  AT76: { lengthM: 27.2, wingspanM: 27.1, seats: '70–78', engines: 'Pratt & Whitney Canada PW127M' },
  DH8D: { lengthM: 32.8, wingspanM: 28.4, seats: '70–78', engines: 'Pratt & Whitney Canada PW150A' },
  C172: { lengthM: 8.3, wingspanM: 11.0, seats: '4', engines: 'Lycoming O-320 (piston)' },
  GLF6: { lengthM: 30.4, wingspanM: 30.4, seats: '14–19', engines: 'Rolls-Royce BR725' },
  CL35: { lengthM: 20.9, wingspanM: 19.6, seats: '8–12', engines: 'Honeywell HTF7000' },
};

export function specsFor(code: string | null): Specs | null {
  return code ? (SPECS[code] ?? null) : null;
}
