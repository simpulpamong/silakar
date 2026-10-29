'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon';
import { useApp } from '@/features/core/AppContext';
import { useAccurateLocation } from '@/features/core/location';
import { composeReportAddress } from '@/features/core/watermark';
import { MAP_DEFAULT, MAP_PICK_ZOOM } from '@/lib/constants';
import type { GpsPoint } from '@/features/core/types';

type LeafletModule = typeof import('leaflet');

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const round6 = (value: number) => Number(value.toFixed(6));

function parseCoord(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validPoint(point: GpsPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

/**
 * Modal pemilih koordinat berbasis Leaflet.
 *
 * Alur: peta dibuka di koordinat saat ini → pengguna mengetuk peta atau
 * menyeret pin (atau mengetikKoordinat) → "Gunakan koordinat ini" menyimpan
 * ke laporan, sehingga ikut terkirim ke Firebase dan terpakai pada watermark.
 */
export default function MapPickerModal() {
  const { mapPickerOpen, closeMapPicker, report, updateReport } = useApp();
  const { busy, locate } = useAccurateLocation();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const [point, setPoint] = useState<GpsPoint>({ lat: MAP_DEFAULT.lat, lng: MAP_DEFAULT.lng });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = report.lat != null && report.lng != null;
  const address = composeReportAddress(report);

  const place = useCallback((next: GpsPoint) => {
    if (!validPoint(next)) return;
    const value = { lat: round6(next.lat), lng: round6(next.lng) };
    setPoint(value);
    markerRef.current?.setLatLng([value.lat, value.lng]);
  }, []);

  /* ── Peta ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapPickerOpen || !containerRef.current) return;

    let disposed = false;

    void (async () => {
      const L = (leafletRef.current ??= (await import('leaflet')).default);
      if (disposed || !containerRef.current) return;

      const start: GpsPoint =
        report.lat != null && report.lng != null
          ? { lat: report.lat, lng: report.lng }
          : { lat: MAP_DEFAULT.lat, lng: MAP_DEFAULT.lng };
      const hasSaved = report.lat != null && report.lng != null;

      setPoint(start);

      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: hasSaved ? MAP_PICK_ZOOM : MAP_DEFAULT.zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);

      const pin = L.divIcon({
        className: 'map-pin-wrap',
        html: '<span class="map-pin"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([start.lat, start.lng], {
        icon: pin,
        draggable: true,
        title: 'Koordinat lokasi laporan',
      }).addTo(map);

      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        setPoint({ lat: round6(lat), lng: round6(lng) });
      });

      map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        setPoint({ lat: round6(event.latlng.lat), lng: round6(event.latlng.lng) });
      });

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);

      // Dialog baru ter-layout setelah modal dirender — paksa hitung ulang ukuran.
      const timer = window.setTimeout(() => map.invalidateSize(), 120);
      return () => window.clearTimeout(timer);
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
    // Inisialisasi cukup satu kali per pembukaan modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPickerOpen]);

  useEffect(() => {
    if (!mapPickerOpen) setError(null);
  }, [mapPickerOpen]);

  const onUseDevice = async () => {
    try {
      const found = await locate();
      const next = { lat: found.lat, lng: found.lng };
      place(next);
      mapRef.current?.setView([next.lat, next.lng], MAP_PICK_ZOOM);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const onCommit = () => {
    if (!validPoint(point)) {
      setError('Koordinat belum valid. Isi latitude dan longitude dengan angka.');
      return;
    }
    updateReport({
      lat: round6(point.lat),
      lng: round6(point.lng),
      coordSource: 'manual',
      coordAccuracy: null,
    });
    closeMapPicker();
  };

  if (!mapPickerOpen) return null;

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      onClick={event => {
        if (event.target === event.currentTarget) closeMapPicker();
      }}
    >
      <div className="dialog dialog-map dialog-picker">
        <div className="dialog-head">
          <h3>
            <Icon name="mapPin" /> Pilih Koordinat Lokasi
          </h3>
          <button
            type="button"
            className="dialog-close static"
            onClick={closeMapPicker}
            aria-label="Tutup"
          >
            <Icon name="x" />
          </button>
        </div>

        <p className="map-meta">
          Ketuk peta atau seret pin untuk menyesuaikan titik.{' '}
          <span className="mono">
            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </span>
        </p>

        <div className="map-picker">
          <div ref={containerRef} className="map-picker-canvas" />
          {!ready && (
            <div className="map-picker-load">
              <Icon name="loader" className="spin" /> Memuat peta…
            </div>
          )}
        </div>

        <div className="coord-edit">
          <label className="mini-field">
            <span>Latitude</span>
            <input
              className="mono"
              value={point.lat.toFixed(6)}
              inputMode="decimal"
              onChange={event => {
                const lat = parseCoord(event.target.value);
                if (lat !== null) place({ lat, lng: point.lng });
              }}
            />
          </label>
          <label className="mini-field">
            <span>Longitude</span>
            <input
              className="mono"
              value={point.lng.toFixed(6)}
              inputMode="decimal"
              onChange={event => {
                const lng = parseCoord(event.target.value);
                if (lng !== null) place({ lat: point.lat, lng });
              }}
            />
          </label>
        </div>

        {address && <p className="picker-address">{address}</p>}
        {error && (
          <p className="hint-warn">
            <Icon name="triangleAlert" />
            <span>{error}</span>
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="dialog-btn tone-ghost" onClick={closeMapPicker}>
            Batal
          </button>
          <button
            type="button"
            className="dialog-btn tone-info"
            onClick={onUseDevice}
            disabled={busy}
          >
            <Icon name={busy ? 'loader' : 'locate'} className={busy ? 'spin' : ''} />
            {busy ? 'Mencari…' : 'Lokasi saya'}
          </button>
          <button
            type="button"
            className="dialog-btn tone-primary"
            onClick={onCommit}
            disabled={!validPoint(point)}
          >
            <Icon name="check" /> Pakai titik ini
          </button>
        </div>

        {saved && (
          <p className="picker-foot">
            <Icon name="info" />
            <span>
              Titik saat ini akan menimpa koordinat sebelumnya dan dikirim ulang ke Firebase.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
