'use client';

import { formatExifTime, nowStamp } from './exif';
import { base64ByteLength } from '@/lib/format';
import { APP_KABUPATEN, APP_NEGARA, APP_PROVINSI, WATERMARK_BRAND } from '@/lib/constants';
import type { GeoAddress, GpsPoint } from './types';

/**
 * Pemrosesan foto: cap watermark (logo + teks + QR lokasi), lalu kompresi
 * adaptif agar selalu di bawah batas ukuran.
 */

export interface WatermarkContext {
  /** Nama program laporan, mis. "Silakar", "Poskamling", "Posyandu". */
  program: string;
  /** Nama Danru / petugas (kosong bila kategori tidak punya nama petugas). */
  unit: string;
  /** Alamat fallback bila foto tidak punya EXIF lokasi. */
  fallbackAddress: string;
  gps?: GpsPoint | null;
  /** True bila koordinat berasal dari isian/pemetaan manual, bukan EXIF. */
  manualGps?: boolean;
  address?: GeoAddress | null;
  capturedAt: string;
}

export interface ProcessedPhoto {
  data: string;
  mime: string;
  sizeKB: number;
  compressed: boolean;
  watermarked: boolean;
}

export interface ProcessPhotoOptions {
  /** Berkas asal (Blob) — di-decode langsung tanpa perantara base64. */
  source: Blob;
  /** Asal foto untuk gaya cap. */
  sourceKind: 'camera' | 'gallery';
  /** Aktifkan watermark. */
  watermark: boolean;
  context: WatermarkContext;
  /** Batas ukuran dalam byte. */
  maxBytes: number;
  /** Sisi terpanjang canvas. */
  maxEdge?: number;
}

const MAX_EDGE = 2400;
const MIN_QUALITY = 0.32;
const BASE_QUALITY = 0.9;

/* ── Sumber gambar ──────────────────────────────────────────────── */

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * Decode foto.
 *
 * `createImageBitmap` dipakai lebih dulu: lebih cepat dan menerapkan orientasi
 * EXIF sehingga foto potret dari ponsel tidak terbalik saat digambar ke canvas.
 * Jalur <img> dipakai sebagai cadangan bila bitmap tidak tersedia/gagal.
 */
async function decode(blob: Blob): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* lanjut ke jalur <img> */
    }
  }

  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/* ── Logo ───────────────────────────────────────────────────────── */

let logoPromise: Promise<HTMLImageElement | null> | null = null;

export function preloadWatermarkLogo() {
  if (typeof document === 'undefined') return;
  if (!logoPromise) {
    logoPromise = new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = '/assets/icon-full.webp';
    });
  }
}

function getLogo(): Promise<HTMLImageElement | null> {
  preloadWatermarkLogo();
  return logoPromise ?? Promise.resolve(null);
}

/* ── QR ─────────────────────────────────────────────────────────── */

/**
 * Pustaka QR dimuat saat pertama kali dibutuhkan agar tidak masuk ke bundel
 * awal halaman — sebagian besar pengguna tidak memfoto dengan GPS.
 */
let qrModule: Promise<typeof import('qrcode')> | null = null;

function loadQr() {
  if (!qrModule) qrModule = import('qrcode');
  return qrModule;
}

async function makeQrCanvas(gps: GpsPoint, size: number): Promise<HTMLCanvasElement | null> {
  try {
    const url = `https://www.google.com/maps?q=${gps.lat.toFixed(6)},${gps.lng.toFixed(6)}`;
    const QRCode = await loadQr();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    await QRCode.toCanvas(canvas, url, {
      width: size,
      margin: 0,
      errorCorrectionLevel: 'L',
      color: { dark: '#000000', light: '#ffffff' },
    });
    return canvas;
  } catch (error) {
    console.warn('[watermark] QR lokasi tidak dapat dibuat', error);
    return null;
  }
}

/* ── Menggambar cap ─────────────────────────────────────────────── */

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const value = text.trim();
  if (!value) return [];
  if (ctx.measureText(value).width <= maxWidth) return [value];

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = ctx.measureText(last).width > maxWidth ? `${last.slice(0, -1)}…` : last;
  }
  return lines;
}

export interface DrawWatermarkArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  source: 'camera' | 'gallery';
  context: WatermarkContext;
  qr: HTMLCanvasElement | null;
  logo: HTMLImageElement | null;
}

export function drawWatermark(args: DrawWatermarkArgs) {
  const { ctx, width, height, source, context, qr, logo } = args;

  const bar = Math.max(3, Math.round(width * 0.005));
  const pad = Math.round(width * 0.02);
  const padV = Math.round(pad * 0.5);
  const logoSize = Math.round(Math.min(width, height) * 0.095);
  const qrSize = qr ? Math.max(72, Math.min(190, Math.round(Math.min(width, height) * 0.13))) : 0;
  const qrPad = qr ? Math.round(pad * 0.55) : 0;

  const fontTitle = Math.max(11, Math.round(logoSize * 0.36));
  const fontBody = Math.max(9, Math.round(logoSize * 0.3));
  const fontSmall = Math.max(7, Math.round(fontBody * 0.72));
  const lineHeight = Math.round(fontBody * 1.5);
  const textX = bar + Math.round(pad * 0.4) + logoSize + Math.round(pad * 0.5);
  const textWidth = width - textX - pad - (qr ? qrSize + qrPad * 2 : 0);

  const address = context.address?.full || context.fallbackAddress;
  const gps = context.gps || null;
  const time = source === 'camera' ? formatExifTime({ dto: context.capturedAt }) : `${nowStamp()} WIB`;
  const coords = gps
    ? `Lat ${gps.lat.toFixed(6)}, Long ${gps.lng.toFixed(6)}${
        context.manualGps ? ' · alamat manual' : ''
      }`
    : source === 'gallery'
      ? 'Lokasi dari input manual'
      : 'Koordinat tidak tersedia';
  const person = context.unit.trim();

  ctx.save();
  ctx.font = `${fontBody}px "Helvetica Neue", Arial, sans-serif`;
  const addressLines = wrapText(ctx, address, textWidth, 3);
  // Baris di bawah judul: program + nama petugas (opsional) + waktu + alamat + koordinat.
  const contentHeight =
    Math.round(fontTitle * 1.45) + (3 + addressLines.length + (person ? 1 : 0)) * lineHeight;
  const stripHeight = Math.max(
    Math.round(height * 0.085),
    padV * 2 + contentHeight,
    qr ? qrSize + padV * 2 : 0,
  );
  const stripY = height - stripHeight;

  // Latar gradasi
  const background = ctx.createLinearGradient(0, stripY, 0, height);
  background.addColorStop(0, 'rgba(4,10,20,0.40)');
  background.addColorStop(0.55, 'rgba(4,10,20,0.66)');
  background.addColorStop(1, 'rgba(4,10,20,0.82)');
  ctx.fillStyle = background;
  ctx.fillRect(0, stripY, width, stripHeight);

  // Aksen biru
  const accent = ctx.createLinearGradient(0, stripY, 0, height);
  accent.addColorStop(0, 'rgba(37,120,214,0.70)');
  accent.addColorStop(1, 'rgba(24,74,168,0.92)');
  ctx.fillStyle = accent;
  ctx.fillRect(0, stripY, bar, stripHeight);

  // Logo
  if (logo && logo.complete && logo.naturalWidth > 0) {
    try {
      ctx.globalAlpha = 0.7;
      ctx.drawImage(
        logo,
        bar + Math.round(pad * 0.4),
        stripY + Math.round((stripHeight - logoSize) / 2),
        logoSize,
        logoSize,
      );
      ctx.globalAlpha = 1;
    } catch {
      /* logo opsional */
    }
  }

  // QR lokasi
  if (qr && qrSize) {
    const qx = width - qrSize - qrPad;
    const qy = stripY + Math.round((stripHeight - qrSize) / 2);
    ctx.fillStyle = '#ffffff';
    const frame = Math.max(3, Math.round(qrSize * 0.03));
    ctx.fillRect(qx - frame, qy - frame, qrSize + frame * 2, qrSize + frame * 2);
    try {
      ctx.drawImage(qr, qx, qy, qrSize, qrSize);
    } catch {
      /* abaikan */
    }
    ctx.font = `700 ${Math.max(7, Math.round(fontSmall * 0.85))}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('LIHAT LOKASI', qx + qrSize / 2, qy - frame - 3);
  }

  // Teks
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = stripY + padV;

  // Judul tetap "DAMKAR PONOROGO" untuk semua kategori.
  ctx.font = `800 ${fontTitle}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,206,74,0.95)';
  ctx.fillText(WATERMARK_BRAND, textX, y, textWidth);
  y += Math.round(fontTitle * 1.45);

  // Baris kedua: hanya program kategori yang sedang berjalan.
  ctx.font = `700 ${fontBody}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(`Program: ${context.program}`, textX, y, textWidth);
  y += lineHeight;

  if (person) {
    ctx.fillText(`Danru: ${person}`, textX, y, textWidth);
    y += lineHeight;
  }

  ctx.font = `400 ${fontBody}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(168,214,255,0.92)';
  ctx.fillText(time, textX, y, textWidth);
  y += lineHeight;

  ctx.font = `500 ${fontBody}px "Helvetica Neue", Arial, sans-serif`;
  const verified = Boolean(context.address?.road);
  ctx.fillStyle = verified ? 'rgba(167,243,208,0.94)' : 'rgba(196,242,214,0.86)';
  for (const line of addressLines) {
    ctx.fillText(line, textX, y, textWidth);
    y += lineHeight;
  }

  ctx.font = `400 ${fontSmall}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(170,196,224,0.88)';
  ctx.fillText(coords, textX, y, textWidth);

  // Wordmark SILAKAR
  const brandSize = Math.max(8, Math.round(width * 0.023));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `900 ${brandSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,205,0,0.55)';
  ctx.fillText('SILAKAR', width - Math.round(pad * 0.4), height - Math.round(pad * 0.25), Math.round(width * 0.24));
  ctx.font = `400 ${Math.round(brandSize * 0.7)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText(
    'Damkar Ponorogo',
    width - Math.round(pad * 0.4),
    height - Math.round(pad * 0.25) - brandSize - 2,
    Math.round(width * 0.2),
  );

  ctx.restore();
}

/* ── Kompresi ───────────────────────────────────────────────────── */

function compress(canvas: HTMLCanvasElement, maxBytes: number, mime: string) {
  let best = canvas.toDataURL(mime, BASE_QUALITY);
  if (base64ByteLength(best) <= maxBytes) {
    return { data: best, compressed: false };
  }

  let low = MIN_QUALITY;
  let high = BASE_QUALITY;
  // Pencarian biner 6 langkah: toDataURL sudah mengaburkan kualitas, jadi
  // iterasi panjang hanya menambah encode sia-sia.
  for (let step = 0; step < 6; step++) {
    const mid = (low + high) / 2;
    const trial = canvas.toDataURL(mime, mid);
    if (base64ByteLength(trial) <= maxBytes) {
      best = trial;
      low = mid;
    } else {
      high = mid;
    }
    if (high - low < 0.04) break;
  }

  return { data: best, compressed: true };
}

/* ── Alur utama ─────────────────────────────────────────────────── */

export async function processPhoto(options: ProcessPhotoOptions): Promise<ProcessedPhoto | null> {
  const { source: blob, sourceKind, watermark, context, maxBytes, maxEdge = MAX_EDGE } = options;

  const decoded = await decode(blob);
  if (!decoded) return null;

  try {
    let width = decoded.width;
    let height = decoded.height;
    if (!width || !height) return null;

    if (width > maxEdge || height > maxEdge) {
      if (width > height) {
        height = Math.round((height * maxEdge) / width);
        width = maxEdge;
      } else {
        width = Math.round((width * maxEdge) / height);
        height = maxEdge;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, width, height);

    if (watermark) {
      const gps = context.gps || null;
      const qr = gps
        ? await makeQrCanvas(gps, Math.max(96, Math.min(260, Math.round(Math.min(width, height) * 0.16))))
        : null;
      drawWatermark({ ctx, width, height, source: sourceKind, context, qr, logo: await getLogo() });
    }

    const { data, compressed } = compress(canvas, maxBytes, 'image/jpeg');
    return {
      data,
      mime: 'image/jpeg',
      sizeKB: Math.round(base64ByteLength(data) / 1024),
      compressed,
      watermarked: watermark,
    };
  } finally {
    decoded.release();
  }
}

/** Alamat gabungan dari lokasi manual (khusus silakar). */
export function composeManualAddress(location: {
  jalan: string;
  nodukuh: string;
  desa: string;
  kec: string;
  kab: string;
  prov: string;
}): string {
  const parts: string[] = [];
  if (location.jalan) {
    parts.push(location.nodukuh ? `${location.jalan} / ${location.nodukuh}` : location.jalan);
  } else if (location.nodukuh) {
    parts.push(location.nodukuh);
  }
  if (location.desa) parts.push(location.desa);
  if (location.kec) parts.push(`Kec. ${location.kec}`);
  if (location.kab) parts.push(location.kab);
  if (location.prov) parts.push(location.prov);
  parts.push(APP_NEGARA);
  return parts.join(', ');
}

/**
 * Alamat lengkap kategori terstruktur, selalu diakhiri wilayah app:
 * `detail alamat, kelurahan, kecamatan, Ponorogo, Jawa Timur, Indonesia`.
 * Bagian kosong dilewati agar tidak ada koma menggantung.
 */
export function composeReportAddress(report: {
  detailAlamat: string;
  desaKelurahan: string;
  kecamatan: string;
}): string {
  return [
    report.detailAlamat,
    report.desaKelurahan,
    report.kecamatan,
    APP_KABUPATEN,
    APP_PROVINSI,
    APP_NEGARA,
  ]
    .map(part => part.trim())
    .filter(Boolean)
    .join(', ');
}
