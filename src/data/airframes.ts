export type AirframeKind = 'narrowbody' | 'widebody' | 'regional' | 'turboprop' | 'bizjet' | 'light' | 'helicopter';

export interface Airframe {
  name: string;
  maker: string;
  kind: AirframeKind;
  engines: number;
  /** One well-established fact about the type. Deliberately few, and no figures we can't verify offline. */
  fact: string;
}

const af = (name: string, maker: string, kind: AirframeKind, engines: number, fact: string): Airframe => ({
  name,
  maker,
  kind,
  engines,
  fact,
});

/** Keyed by ICAO type designator, as broadcast in ADS-B. Unknown codes fall back gracefully. */
export const AIRFRAMES: Record<string, Airframe> = {
  A319: af('Airbus A319', 'Airbus', 'narrowbody', 2, 'A shortened A320-family jet, common on short domestic routes.'),
  A320: af('Airbus A320', 'Airbus', 'narrowbody', 2, 'One of the most-built airliner families in history.'),
  A321: af('Airbus A321', 'Airbus', 'narrowbody', 2, 'The stretched member of the A320 family.'),
  A20N: af('Airbus A320neo', 'Airbus', 'narrowbody', 2, 'The A320 with new engines and better fuel efficiency.'),
  A21N: af('Airbus A321neo', 'Airbus', 'narrowbody', 2, 'The A321 with new engines and better fuel efficiency.'),
  A333: af('Airbus A330-300', 'Airbus', 'widebody', 2, 'A twin-engine widebody common on long-haul routes.'),
  A339: af('Airbus A330-900neo', 'Airbus', 'widebody', 2, 'The A330 with new engines and a refreshed wing.'),
  A359: af('Airbus A350-900', 'Airbus', 'widebody', 2, 'Built largely from carbon-fibre composites.'),
  A35K: af('Airbus A350-1000', 'Airbus', 'widebody', 2, 'The longest A350, with the most seats in the family.'),
  A388: af('Airbus A380-800', 'Airbus', 'widebody', 4, 'The largest passenger airliner ever built, with two full passenger decks.'),
  B738: af('Boeing 737-800', 'Boeing', 'narrowbody', 2, 'The 737 is the best-selling airliner family in history.'),
  B739: af('Boeing 737-900', 'Boeing', 'narrowbody', 2, 'A stretched 737 with extra room for passengers.'),
  B38M: af('Boeing 737 MAX 8', 'Boeing', 'narrowbody', 2, 'The 737 with new engines, larger winglets and better fuel efficiency.'),
  B39M: af('Boeing 737 MAX 9', 'Boeing', 'narrowbody', 2, 'A stretched 737 MAX 8 with more seats.'),
  B744: af('Boeing 747-400', 'Boeing', 'widebody', 4, 'The "Queen of the Skies" pioneered the widebody era.'),
  B748: af('Boeing 747-8', 'Boeing', 'widebody', 4, 'The last and largest 747 variant, with a stretched fuselage.'),
  B752: af('Boeing 757-200', 'Boeing', 'narrowbody', 2, 'A narrowbody with the power to fly long, thin routes.'),
  B763: af('Boeing 767-300', 'Boeing', 'widebody', 2, 'A twin-aisle jet, widely used on transatlantic routes.'),
  B772: af('Boeing 777-200', 'Boeing', 'widebody', 2, 'A twin-engine widebody with exceptional range for its time.'),
  B77W: af('Boeing 777-300ER', 'Boeing', 'widebody', 2, 'One of the longest-range twin-engine airliners in service.'),
  B788: af('Boeing 787-8', 'Boeing', 'widebody', 2, 'Built largely from carbon-fibre composites.'),
  B789: af('Boeing 787-9', 'Boeing', 'widebody', 2, 'The 787 uses carbon-fibre composites for much of its airframe.'),
  B78X: af('Boeing 787-10', 'Boeing', 'widebody', 2, 'The longest 787, stretched from the -9.'),
  E190: af('Embraer E190', 'Embraer', 'regional', 2, 'A regional jet built in Brazil.'),
  E195: af('Embraer E195', 'Embraer', 'regional', 2, 'The largest regional jet in the E-Jet family.'),
  CRJ9: af('Bombardier CRJ900', 'Bombardier', 'regional', 2, 'A regional jet that links smaller cities to hubs.'),
  AT76: af('ATR 72-600', 'ATR', 'turboprop', 2, 'A twin turboprop, efficient on short sectors.'),
  DH8D: af('De Havilland Dash 8-400', 'De Havilland Canada', 'turboprop', 2, 'A twin turboprop that is quiet and efficient on short hops.'),
  C172: af('Cessna 172', 'Cessna', 'light', 1, 'The most-built aircraft in history, a single-engine trainer.'),
  GLF6: af('Gulfstream G650', 'Gulfstream', 'bizjet', 2, 'A long-range business jet.'),
  CL35: af('Bombardier Challenger 350', 'Bombardier', 'bizjet', 2, 'A mid-size business jet.'),
};

export function airframeFor(code: string | null): Airframe | null {
  return code ? (AIRFRAMES[code] ?? null) : null;
}

/** ADS-B emitter categories: how the transmitter describes its size and role. */
export const CATEGORY_LABEL: Record<string, string> = {
  A1: 'Light (under 15,500 lb)',
  A2: 'Small (15,500–75,000 lb)',
  A3: 'Large (75,000–300,000 lb)',
  A4: 'Large, high-vortex (e.g. Boeing 757)',
  A5: 'Heavy (over 300,000 lb)',
  A6: 'High-performance (fighter-class)',
  A7: 'Rotorcraft (helicopter)',
};
