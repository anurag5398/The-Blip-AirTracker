// ICAO three-letter callsign prefixes for major global carriers
const PREFIXES: Record<string, string> = {
  AAL: 'American Airlines', DAL: 'Delta', UAL: 'United', SWA: 'Southwest', JBU: 'JetBlue', ASA: 'Alaska Airlines',
  ACA: 'Air Canada', BAW: 'British Airways', EZY: 'easyJet', RYR: 'Ryanair', VLG: 'Vueling', IBE: 'Iberia',
  DLH: 'Lufthansa', AFR: 'Air France', KLM: 'KLM', SAS: 'SAS', SWR: 'Swiss', AUA: 'Austrian', THY: 'Turkish Airlines',
  AZA: 'ITA Airways', FIN: 'Finnair', ETD: 'Etihad', UAE: 'Emirates', QTR: 'Qatar Airways', GFA: 'Gulf Air',
  SVA: 'Saudia', RJA: 'Royal Jordanian', ELY: 'El Al', MEA: 'Middle East Airlines', ETH: 'Ethiopian',
  SAA: 'South African', KQA: 'Kenya Airways', RAM: 'Royal Air Maroc', AIC: 'Air India', IGO: 'IndiGo',
  AXB: 'Air India Express', SIA: 'Singapore Airlines', MAS: 'Malaysia Airlines', THA: 'Thai Airways',
  VJC: 'VietJet', CPA: 'Cathay Pacific', CES: 'China Eastern', CSN: 'China Southern', CCA: 'Air China',
  HVN: 'Vietnam Airlines', KAL: 'Korean Air', AAR: 'Asiana', ANA: 'ANA', JAL: 'Japan Airlines', QFA: 'Qantas',
  VOZ: 'Virgin Australia', ANZ: 'Air New Zealand', LAN: 'LATAM', AMX: 'Aeromexico', AVA: 'Avianca',
  CMP: 'Copa', GLO: 'GOL', FDX: 'FedEx', UPS: 'UPS', CLX: 'Cargolux', ICE: 'Icelandair',
};

export function airlineFor(callsign: string): string | null {
  return PREFIXES[callsign.slice(0, 3).toUpperCase()] ?? null;
}
