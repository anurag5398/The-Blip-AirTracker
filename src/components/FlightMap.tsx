import type { FeatureCollection, MultiLineString, Point } from 'geojson';
import {
  Map as MapLibreMap,
  NavigationControl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { BBox } from '../../shared/geo';
import { ALERT_COLOR, RARITY_COLOR, toFeatureCollection, toTrailCollection, type Blip, type BlipProperties, type Trails } from '../lib/flights';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const BLIP_SOURCE = 'blips';
const TRAIL_SOURCE = 'trails';
const TRAIL_LAYER = 'blip-trails';
const GLOW_LAYER = 'blip-glow';
const ALERT_LAYER = 'blip-alert';
const HALO_LAYER = 'blip-halo';
const ICON_LAYER = 'blip-icons';
const PLANE_IMAGE = 'plane';
const HELI_IMAGE = 'heli';

// The palette for the whole basemap: deep navy ocean, slightly lifted land, near-black space.
// Roads, rivers, rail and borders are removed entirely, so nothing draws bright lines over the globe.
const OCEAN = '#0a1d36';
const LAND = '#0e1c30';
const GROUND = '#060b15';
const PLACE_TEXT = '#6f86a6';

// Pulse period for squawk-alert rings, in ms
const ALERT_PULSE_MS = 900;
// Position updates are throttled. Planes move slowly on screen, so 2 Hz is plenty and keeps zoom smooth.
const POSITION_TICK_MS = 500;

const EMPTY_BLIPS: FeatureCollection<Point, BlipProperties> = { type: 'FeatureCollection', features: [] };
const EMPTY_TRAILS: FeatureCollection<MultiLineString, { rarity: string }> = { type: 'FeatureCollection', features: [] };

// Single-colour glyphs; tinted per rarity via icon-color (sdf)
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="#000" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
const HELI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><g fill="#000"><ellipse cx="12" cy="12" rx="3.2" ry="6.5"/><rect x="11" y="1" width="2" height="22" rx="1"/><rect x="2" y="11" width="20" height="2" rx="1" opacity="0.7"/></g></svg>`;

const RARITY_MATCH: ExpressionSpecification = [
  'match',
  ['get', 'rarity'],
  'common', RARITY_COLOR.common,
  'rare', RARITY_COLOR.rare,
  'epic', RARITY_COLOR.epic,
  'legendary', RARITY_COLOR.legendary,
  '#ffffff',
];

const ICON_IMAGE: ExpressionSpecification = ['match', ['get', 'kind'], 'heli', HELI_IMAGE, PLANE_IMAGE];

export interface FlyRequest {
  id: number;
  center: [number, number];
  zoom: number;
}

interface Props {
  blips: Blip[];
  trails: Trails;
  selectedHex: string | null;
  /** Identify-the-sky mode: contacts are drawn identically and without trails */
  masked?: boolean;
  flyRequest: FlyRequest | null;
  onSelect: (hex: string | null) => void;
  onViewport: (bbox: BBox, zoom: number) => void;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image(64, 64);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img.decode().then(() => img);
}

/** Recolours and removes layers so the basemap reads as a quiet navy globe. Each change is guarded: a missing layer is skipped. */
function tuneBasemap(map: MapLibreMap) {
  const HIDE = /road|bridge|tunnel|rail|waterway|ferry|aeroway|transit|boundary|admin|path|pedestrian|building|poi|street/;
  for (const layer of map.getStyle().layers) {
    try {
      if (HIDE.test(layer.id) || (layer.type === 'line' && !/water/.test(layer.id))) {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } else if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', GROUND);
      } else if (layer.type === 'fill' && /water|ocean/.test(layer.id)) {
        map.setPaintProperty(layer.id, 'fill-color', OCEAN);
      } else if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', LAND);
      } else if (layer.type === 'symbol' && /place|label/.test(layer.id)) {
        map.setPaintProperty(layer.id, 'text-color', PLACE_TEXT);
        map.setPaintProperty(layer.id, 'text-halo-color', GROUND);
      }
    } catch {
      // A layer without that property: leave it alone rather than break the map
    }
  }
}

/**
 * Viewport as a bbox, derived from centre + zoom. `getBounds()` returns the whole world while the
 * globe projection is active, which would make every view look too wide to scan.
 */
function viewportOf(map: MapLibreMap): BBox {
  const { lng, lat } = map.getCenter();
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const degPerPx = 360 / (512 * 2 ** map.getZoom());
  const halfLon = (w / 2) * degPerPx * 1.2;
  const halfLat = (h / 2) * degPerPx * Math.cos((lat * Math.PI) / 180) * 1.2;
  return {
    south: Math.max(-90, lat - halfLat),
    north: Math.min(90, lat + halfLat),
    west: Math.max(-180, lng - halfLon),
    east: Math.min(180, lng + halfLon),
  };
}

export function FlightMap({ blips, trails, selectedHex, masked = false, flyRequest, onSelect, onViewport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ blips, trails, selectedHex, masked, onSelect, onViewport });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latest.current = { blips, trails, selectedHex, masked, onSelect, onViewport };
  });

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: STYLE_URL,
      center: [15, 25],
      zoom: 1.6,
      minZoom: 1.2,
      maxZoom: 12,
      maxPitch: 0,
      renderWorldCopies: false,
      fadeDuration: 150,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', async () => {
      map.setProjection({ type: 'globe' });
      tuneBasemap(map);
      map.addImage(PLANE_IMAGE, await loadImage(PLANE_SVG), { sdf: true });
      map.addImage(HELI_IMAGE, await loadImage(HELI_SVG), { sdf: true });
      map.addSource(TRAIL_SOURCE, { type: 'geojson', data: EMPTY_TRAILS });
      map.addSource(BLIP_SOURCE, { type: 'geojson', data: EMPTY_BLIPS });

      map.addLayer({
        id: TRAIL_LAYER,
        type: 'line',
        source: TRAIL_SOURCE,
        minzoom: 3,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': RARITY_MATCH,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 2],
          'line-opacity': 0.4,
        },
      });

      map.addLayer({
        id: GLOW_LAYER,
        type: 'circle',
        source: BLIP_SOURCE,
        filter: ['in', ['get', 'rarity'], ['literal', ['rare', 'epic', 'legendary']]],
        paint: {
          'circle-radius': ['match', ['get', 'rarity'], 'legendary', 14, 'epic', 11, 8],
          'circle-color': RARITY_MATCH,
          'circle-opacity': 0.3,
          'circle-blur': 0.9,
        },
      });

      map.addLayer({
        id: ALERT_LAYER,
        type: 'circle',
        source: BLIP_SOURCE,
        filter: ['==', ['get', 'alert'], true],
        paint: { 'circle-radius': 16, 'circle-color': ALERT_COLOR, 'circle-opacity': 0.45, 'circle-blur': 0.6 },
      });

      map.addLayer({
        id: HALO_LAYER,
        type: 'circle',
        source: BLIP_SOURCE,
        filter: ['==', ['get', 'selected'], true],
        paint: {
          'circle-radius': 15,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
        },
      });

      map.addLayer({
        id: ICON_LAYER,
        type: 'symbol',
        source: BLIP_SOURCE,
        layout: {
          'icon-image': ICON_IMAGE,
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 0.6, 10, 0.85],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': RARITY_MATCH,
          'icon-opacity': ['case', ['get', 'onGround'], 0.35, 1],
          'icon-halo-color': 'rgba(5, 7, 13, 0.9)',
          'icon-halo-width': 1.5,
        },
      });

      // Squawk alerts pulse: the ring breathes in and out on a timer
      let pulseUp = false;
      const pulse = window.setInterval(() => {
        pulseUp = !pulseUp;
        if (map.getLayer(ALERT_LAYER)) map.setPaintProperty(ALERT_LAYER, 'circle-radius', pulseUp ? 22 : 12);
      }, ALERT_PULSE_MS);
      map.once('remove', () => window.clearInterval(pulse));

      // Position updates happen here, not in React: they never compete with a zoom or pan
      const push = () => {
        if (map.isMoving()) return;
        const { blips: b, trails: t, selectedHex: sel, masked: m } = latest.current;
        const now = Date.now();
        map.getSource<GeoJSONSource>(BLIP_SOURCE)?.setData(toFeatureCollection(b, now, sel, m));
        map.getSource<GeoJSONSource>(TRAIL_SOURCE)?.setData(m ? EMPTY_TRAILS : toTrailCollection(t, b, now));
      };
      const tick = window.setInterval(push, POSITION_TICK_MS);
      map.once('remove', () => window.clearInterval(tick));
      map.on('moveend', push);

      map.on('click', (e: MapMouseEvent) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: [ICON_LAYER] })[0];
        latest.current.onSelect((hit?.properties.hex as string | undefined) ?? null);
      });
      map.on('mouseenter', ICON_LAYER, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', ICON_LAYER, () => (map.getCanvas().style.cursor = ''));
      map.on('moveend', () => latest.current.onViewport(viewportOf(map), map.getZoom()));

      mapRef.current = map;
      setReady(true);
      latest.current.onViewport(viewportOf(map), map.getZoom());
      push();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Blips changed (new poll or new filter): push right away, unless the user is mid-gesture
  useEffect(() => {
    if (!ready || !mapRef.current || mapRef.current.isMoving()) return;
    const now = Date.now();
    mapRef.current.getSource<GeoJSONSource>(BLIP_SOURCE)?.setData(toFeatureCollection(blips, now, selectedHex, masked));
    mapRef.current.getSource<GeoJSONSource>(TRAIL_SOURCE)?.setData(masked ? EMPTY_TRAILS : toTrailCollection(trails, blips, now));
  }, [blips, trails, selectedHex, masked, ready]);

  useEffect(() => {
    if (!ready || !flyRequest) return;
    mapRef.current?.flyTo({ center: flyRequest.center, zoom: flyRequest.zoom, duration: 1800, essential: true });
  }, [flyRequest, ready]);

  // Outer box is positioned by us; MapLibre's own class forces `position: relative` on its container
  return (
    <div className="absolute inset-0" role="application" aria-label="Live aircraft map">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
