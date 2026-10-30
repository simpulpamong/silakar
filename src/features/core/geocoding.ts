import type { GeoAddress } from './types';

/**
 * Reverse geocoding presisi tinggi, 100% gratis (OpenStreetMap).
 *
 * Strategi (dua sumber paralel, lalu digabung):
 *  1. Nominatim  -> alamat dasar, nama tempat (POI), cadangan.
 *  2. Overpass   -> data mentah OSM di sekitar titik:
 *       - jalan bernama TERDEKAT (jarak titik ke segmen garis, bukan ke node),
 *       - nomor rumah / kode pos dari bangunan dalam radius kecil,
 *       - hierarki batas administrasi (provinsi, kab/kota, kecamatan, desa/kel)
 *         lewat is_in, jauh lebih andal daripada tebakan label Nominatim.
 *
 * Catatan jujur: akurasi akhir dibatasi oleh kelengkapan data OSM di lokasi
 * dan akurasi GPS perangkat. Tidak ada sumber gratis yang menjamin 5 m / setara
 * Google Maps. Bagian yang tidak ditemukan sengaja DIKOSONGKAN, tidak ditebak.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Isi dengan email kontak aplikasi Anda (diwajibkan kebijakan Nominatim). */
const CONTACT_EMAIL = '';

const TTL_MS = 10 * 60 * 1000;
const NOMINATIM_TIMEOUT_MS = 5_000;
const OVERPASS_TIMEOUT_MS = 8_000;
const REQUEST_INTERVAL_MS = 1_000;
const DETAIL_ZOOM = 18;

const ROAD_RADIUS_M = 50;
const HOUSE_RADIUS_M = 20;
const POSTCODE_RADIUS_M = 60;

interface NominatimResponse {
  category?: string;
  type?: string;
  address?: Record<string, string>;
  namedetails?: { name?: string };
  name?: string;
}

interface LatLon { lat: number; lon: number }
interface OsmElement {
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: LatLon;
  geometry?: LatLon[];
  tags?: Record<string, string>;
}

interface OverpassResult {
  road: string | null;
  roadDistance: number;
  houseNumber: string | null;
  postcode: string | null;
  admin: Partial<Record<'province' | 'regency' | 'district' | 'village', string>>;
}

const cache = new Map<string, { at: number; value: GeoAddress }>();
const inFlight = new Map<string, Promise<GeoAddress>>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

/* ---------- utilitas ---------- */

function scheduleRequest<T>(request: () => Promise<T>): Promise<T> {
  const scheduled = requestQueue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise<void>(r => setTimeout(r, delay));
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
    return request();
  });
  requestQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`http ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ~1 m per 0.00001 derajat; 5 desimal cukup untuk cache tanpa kehilangan presisi.
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('id');

/** Jarak (meter) titik P ke segmen AB, proyeksi lokal equirectangular. */
function distToSegment(p: LatLon, a: LatLon, b: LatLon): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const mx = 111_320 * k;
  const my = 110_540;
  const ax = (a.lon - p.lon) * mx, ay = (a.lat - p.lat) * my;
  const bx = (b.lon - p.lon) * mx, by = (b.lat - p.lat) * my;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function distToPoint(p: LatLon, q: LatLon): number {
  return distToSegment(p, q, q);
}

function distToWay(p: LatLon, geometry: LatLon[]): number {
  if (geometry.length === 1) return distToPoint(p, geometry[0]);
  let best = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    best = Math.min(best, distToSegment(p, geometry[i], geometry[i + 1]));
  }
  return best;
}

function elementPoint(el: OsmElement): LatLon | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return el.center;
  if (el.geometry?.length) return el.geometry[0];
  return null;
}

/* ---------- Overpass ---------- */

function overpassQuery(lat: number, lng: number): string {
  return `[out:json][timeout:8];
(
  way(around:${ROAD_RADIUS_M},${lat},${lng})["highway"]["name"]
    ["highway"!~"^(proposed|construction|platform|corridor|steps|elevator)$"];
);
out tags geom;
(
  nwr(around:${POSTCODE_RADIUS_M},${lat},${lng})["addr:housenumber"];
  nwr(around:${POSTCODE_RADIUS_M},${lat},${lng})["addr:postcode"];
);
out tags center;
is_in(${lat},${lng})->.a;
rel(pivot.a)["boundary"~"^(administrative|postal_code)$"];
out tags;`;
}

async function fetchOverpass(lat: number, lng: number): Promise<OsmElement[]> {
  const body = new URLSearchParams({ data: overpassQuery(lat, lng) });
  let lastError: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const json = await fetchJson<{ elements?: OsmElement[] }>(
        mirror,
        { method: 'POST', body, headers: { Accept: 'application/json' } },
        OVERPASS_TIMEOUT_MS,
      );
      return json.elements || [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function analyseOverpass(elements: OsmElement[], origin: LatLon): OverpassResult {
  const result: OverpassResult = {
    road: null, roadDistance: Infinity, houseNumber: null, postcode: null, admin: {},
  };

  // 1) Jalan terdekat (jarak ke garis jalan).
  for (const el of elements) {
    const tags = el.tags;
    if (el.type !== 'way' || !tags?.highway || !tags.name || !el.geometry) continue;
    const d = distToWay(origin, el.geometry);
    if (d < result.roadDistance) {
      result.roadDistance = d;
      result.road = tags.name.trim();
    }
  }

  // 2) Nomor rumah & kode pos dari fitur alamat terdekat.
  let bestHouse = Infinity;
  let bestPostcode = Infinity;
  for (const el of elements) {
    const tags = el.tags;
    if (!tags || el.type === 'relation') continue;
    const point = elementPoint(el);
    if (!point) continue;
    const d = distToPoint(origin, point);

    const street = tags['addr:street'];
    const streetOk = !street || !result.road || norm(street) === norm(result.road);
    const number = tags['addr:housenumber'];
    if (number && d <= HOUSE_RADIUS_M && streetOk && d < bestHouse) {
      bestHouse = d;
      result.houseNumber = number.trim();
    }
    const postcode = tags['addr:postcode'];
    if (postcode && /^\d{5}$/.test(postcode.trim()) && d < bestPostcode) {
      bestPostcode = d;
      result.postcode = postcode.trim();
    }
  }

  // 3) Batas administrasi (Indonesia: 4 provinsi, 5 kab/kota, 6 kecamatan, 7 desa/kel).
  const levels: Record<string, keyof OverpassResult['admin']> = {
    '4': 'province', '5': 'regency', '6': 'district', '7': 'village',
  };
  for (const el of elements) {
    const tags = el.tags;
    if (el.type !== 'relation' || !tags) continue;
    if (tags.boundary === 'postal_code') {
      const code = (tags.postal_code || tags.ref || '').trim();
      if (!result.postcode && /^\d{5}$/.test(code)) result.postcode = code;
      continue;
    }
    const key = levels[tags.admin_level];
    const name = tags.name?.trim();
    if (key && name && !result.admin[key]) result.admin[key] = name;
  }

  return result;
}

/* ---------- Nominatim ---------- */

async function fetchNominatim(lat: number, lng: number): Promise<NominatimResponse> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: String(DETAIL_ZOOM),
    addressdetails: '1',
    namedetails: '1',
    layer: 'address,poi',
    'accept-language': 'id-ID,id,en',
  });
  if (CONTACT_EMAIL) params.set('email', CONTACT_EMAIL);
  return scheduleRequest(() =>
    fetchJson<NominatimResponse>(`${NOMINATIM}?${params}`, { headers: { Accept: 'application/json' } }, NOMINATIM_TIMEOUT_MS),
  );
}

const ROAD_KEYS = [
  'road', 'pedestrian', 'footway', 'path', 'cycleway', 'service', 'track',
  'living_street', 'residential', 'unclassified', 'tertiary', 'secondary',
  'primary', 'trunk', 'motorway',
];

function nominatimRoad(address: Record<string, string>): string | null {
  for (const key of ROAD_KEYS) if (address[key]) return address[key];
  return null;
}

const POI_CATEGORIES = new Set([
  'amenity', 'shop', 'tourism', 'office', 'leisure', 'historic', 'building', 'man_made', 'craft', 'healthcare',
]);

/* ---------- penyusunan alamat ---------- */

const LABELED = /^(desa|kelurahan|kel\.?|kecamatan|kec\.?|kabupaten|kab\.?|kota|provinsi|prov\.?|dukuh|dusun|lingkungan|jl\.?|jalan|gang|gg\.?)\b/i;

function appendPart(parts: string[], seen: Set<string>, value: string | undefined | null, label = '') {
  const name = value?.trim();
  if (!name) return;
  const key = norm(name);
  if (seen.has(key)) return;
  seen.add(key);
  parts.push(label && !LABELED.test(name) ? `${label} ${name}` : name);
}

function buildAddress(
  nom: NominatimResponse | null,
  osm: OverpassResult | null,
): GeoAddress {
  const a = nom?.address || {};

  // Jalan: Overpass (jarak ke garis) lebih dipercaya daripada Nominatim.
  const road = osm?.road || (nom ? nominatimRoad(a) : null);

  // Nomor rumah: Overpass; atau Nominatim hanya jika jalannya sama.
  let houseNumber = osm?.houseNumber || null;
  if (!houseNumber && a.house_number) {
    const nr = nom ? nominatimRoad(a) : null;
    if (!road || !nr || norm(nr) === norm(road)) houseNumber = a.house_number;
  }

  // Nama tempat hanya untuk POI sungguhan, bukan nama jalan/batas wilayah.
  const placeName =
    nom?.category && POI_CATEGORIES.has(nom.category)
      ? nom.namedetails?.name || nom.name
      : undefined;

  const adm = osm?.admin || {};
  const village = adm.village || a.village || a.suburb || a.neighbourhood;
  const villageLabel = a.village || adm.village ? 'Desa' : 'Kel.';
  const district = adm.district || a.subdistrict || a.city_district || a.district;
  const isCity = !!a.city || /^kota\b/i.test(adm.regency || '');
  const regency = adm.regency || a.city || a.regency || a.county || a.municipality || a.state_district;
  const province = adm.province || a.state;
  const postcode = osm?.postcode || a.postcode;

  const parts: string[] = [];
  const seen = new Set<string>();
  appendPart(parts, seen, road ? (houseNumber ? `${road} No.${houseNumber}` : road) : null);
  appendPart(parts, seen, placeName);
  appendPart(parts, seen, a.hamlet || a.allotments, 'Dukuh');
  appendPart(parts, seen, village, villageLabel);
  appendPart(parts, seen, district, 'Kec.');
  appendPart(parts, seen, regency, isCity ? 'Kota' : 'Kab.');
  appendPart(parts, seen, province);
  appendPart(parts, seen, postcode);
  appendPart(parts, seen, a.country || 'Indonesia');

  return { full: parts.join(', '), road: road || '', parts };
}

function buildFallback(lat: number, lng: number): GeoAddress {
  return { full: `${lat.toFixed(6)}, ${lng.toFixed(6)}, Indonesia`, road: '', parts: [] };
}

/* ---------- alur utama ---------- */

async function resolve(lat: number, lng: number): Promise<GeoAddress> {
  const origin: LatLon = { lat, lon: lng };
  const [nomRes, osmRes] = await Promise.allSettled([
    fetchNominatim(lat, lng),
    fetchOverpass(lat, lng),
  ]);

  const nom = nomRes.status === 'fulfilled' ? nomRes.value : null;
  const osm = osmRes.status === 'fulfilled' ? analyseOverpass(osmRes.value, origin) : null;
  if (!nom && !osm) return buildFallback(lat, lng);

  const result = buildAddress(nom, osm);
  return result.parts.length > 1 ? result : buildFallback(lat, lng);
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
      // Jangan cache hasil fallback koordinat agar bisa dicoba ulang.
      if (value.parts.length > 0) cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}
