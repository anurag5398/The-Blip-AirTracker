import type { Blip } from './flights';

export function formatAltitude(b: Pick<Blip, 'alt' | 'onGround'>): string {
  if (b.onGround) return 'GND';
  return b.alt == null ? '—' : `FL${Math.round(b.alt / 100)}`;
}

export function formatFeet(ft: number | null): string {
  return ft == null ? '—' : `${ft.toLocaleString('en-US')} ft`;
}

export function formatSpeed(knots: number | null): string {
  return knots == null ? '—' : `${Math.round(knots)} kt`;
}
