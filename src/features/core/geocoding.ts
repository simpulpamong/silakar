import type { GeoAddress } from './types';

/**
 * Reverse geocoding ringan (OpenStreetMap / Nominatim).
 *
 * - Cache in-memory dengan TTL agar foto berdekatan tidak memanggil API berulang.
 * - Satu permintaan pada zoom detail agar hasil konsisten dan hemat kuota.
 * - Selalu mengembalikan nilai (fallback ke koordinat) supaya watermark
 *   tidak pernah menggantung.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5_000;
const REQUEST_INTERVAL_MS = 1_000;
const DETAIL_ZOOM = 18;

interface NominatimResponse {
  address?: Record<string, string>;
  namedetails?: { name?: string };
  name?: string;
  display_name?: string;
}

const cache = new Map<string, { at: number; value: GeoAddress }>();
const inFlight = new Map<string, Promise<GeoAddress>>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function scheduleRequest<T>(request: () => Promise<T>): Promise<T> {
  const scheduled = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise<void>(resolve => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
    return request();
  });
  requestQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function appendPart(parts: string[], seen: Set<string>, value: string | undefined, label = '') {
  const name = value?.trim();
  if (!name) return;

  const key = name.toLocaleLowerCase('id');
  if (seen.has(key)) return;
  seen.add(key);

  const alreadyLabeled = /^(desa|kelurahan|kel\.?|kecamatan|kec\.?|kabupaten|kab\.?|kota|provinsi|dukuh|dusun|lingkungan)\b/i.test(name);
  parts.push(label && !alreadyLabeled ? `${label} ${name}` : name);
}

function buildFromAddress(
  road: string | null,
  houseNumber: string | null,
  address: Record<string, string>,
  placeName?: string,
): GeoAddress {
  const parts: string[] = [];
  const seen = new Set<string>();
  appendPart(parts, seen, road ? (houseNumber ? `${road} No.${houseNumber}` : road) : undefined);
  appendPart(parts, seen, placeName);
  appendPart(parts, seen, address.hamlet || address.allotments, 'Dukuh');
  appendPart(parts, seen, address.neighbourhood || address.quarter, 'Lingkungan');
  appendPart(parts, seen, address.village, 'Desa');
  appendPart(parts, seen, address.suburb, 'Kelurahan');
  appendPart(parts, seen, address.subdistrict || address.city_district || address.district, 'Kec.');
  appendPart(parts, seen, address.town);
  appendPart(parts, seen, address.city, 'Kota');
  appendPart(parts, seen, address.municipality);
  appendPart(parts, seen, address.regency || address.county, 'Kab.');
  appendPart(parts, seen, address.state_district, 'Kab.');
  appendPart(parts, seen, address.state);
  appendPart(parts, seen, address.postcode, 'Kode Pos');
  appendPart(parts, seen, address.country || 'Indonesia');

  return { full: parts.join(', '), road: road || '', parts };
}

function buildFallback(lat: number, lng: number, address?: Record<string, string>): GeoAddress {
  if (address) {
    const result = buildFromAddress(null, null, address);
    if (result.parts.length > 1) return result;
  }
  return { full: `${lat.toFixed(5)}, ${lng.toFixed(5)}, Indonesia`, road: '', parts: [] };
}

const ROAD_KEYS = [
  'road', 'silakar', 'footway', 'path', 'cycleway', 'service', 'track',
  'living_street', 'residential', 'unclassified', 'tertiary', 'secondary',
  'primary', 'trunk', 'motorway', 'highway',
];

function extractRoad(data: NominatimResponse): string | null {
  const address = data.address || {};
  for (const key of ROAD_KEYS) {
    const value = address[key];
    if (value) return value;
  }
  return null;
}

async function fetchReverse(lat: number, lng: number, signal: AbortSignal) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: String(DETAIL_ZOOM),
    addressdetails: '1',
    namedetails: '1',
    'accept-language': 'id-ID,id,en',
  });
  const response = await fetch(`${ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);
  return (await response.json()) as NominatimResponse;
}

async function resolve(lat: number, lng: number): Promise<GeoAddress> {
  try {
    const data = await scheduleRequest(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        return await fetchReverse(lat, lng, controller.signal);
      } finally {
        clearTimeout(timer);
      }
    });
    const address = data.address || {};
    const placeName = data.namedetails?.name || data.name;
    return buildFromAddress(extractRoad(data), address.house_number || null, address, placeName);
  } catch {
    return buildFallback(lat, lng);
  }
}

export function reverseGeocode(lat: number, lng: number): Promise<GeoAddress> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Promise.resolve(buildFallback(0, 0));
  }

  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = resolve(lat, lng)
    .then(value => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

