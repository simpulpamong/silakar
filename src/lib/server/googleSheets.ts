import { getSpreadsheetId, withSheetsFallback } from './googleAuth';
import { parseReport } from '../silakarParser';
import { formatWib } from '../format';
import { REPORT_HEADERS as CONTRACT_REPORT_HEADERS, PHOTO_HEADERS as CONTRACT_PHOTO_HEADERS } from './schema-contract';

export const SHEET = {
  reports: { kebakaran: 'KEBAKARAN', odnk: 'ODNK' },
  photos: { kebakaran: 'DOKUMENTASI KEBAKARAN', odnk: 'DOKUMENTASI ODNK' },
} as const;

function categoryKey(category?: string): 'kebakaran' | 'odnk' {
  return String(category || '').toLowerCase() === 'odnk' ? 'odnk' : 'kebakaran';
}

/** Jumlah kolom foto pada sheet INPUT (kolom M sampai V). */
export const PHOTO_COLUMNS = 10;

export { parseReport, buildPhotoFileName, parseIndonesianDate, mimeToExt } from '../silakarParser';
export type { ParsedReport } from '../silakarParser';

/* ── Struktur baris ─────────────────────────────────────────────── */

/** Canonical column order for both report tabs (KEBAKARAN and ODNK). */
export const REPORT_HEADERS = CONTRACT_REPORT_HEADERS;
export const PHOTO_HEADERS = CONTRACT_PHOTO_HEADERS;

export interface PhotoMeta {
  hasGps?: boolean;
  lat?: number | null;
  lng?: number | null;
  datetime?: string | null;
  address?: string | null;
  source?: string;
}

export interface PhotoLink {
  link: string;
  namaFile: string;
  source?: string;
  meta?: PhotoMeta | null;
}

export interface ReportRowInput {
  parsed: ReturnType<typeof parseReport>;
  photos: PhotoLink[];
  folderUrl?: string;
  createdAt?: Date;
  kategori?: 'kebakaran' | 'odnk';
  rawText?: string;
}

export interface PhotoRowInput {
  idLaporan?: string;
  kategori?: 'kebakaran' | 'odnk';
  tanggal: string;
  danru: string;
  namaFile: string;
  source: string;
  meta?: PhotoMeta | null;
  linkDrive: string;
  fileId?: string;
  folderId?: string;
  folderUrl?: string;
  fallbackLat?: number;
  fallbackLng?: number;
  ket?: string;
  createdAt?: Date;
}

/* ── Pembentuk baris (fungsi murni) ──────────────────────────────── */

/** Baris utama laporan di sheet INPUT. */
export function buildReportRow(input: ReportRowInput): (string | number)[] {
  const { parsed, photos } = input;
  const fallbackGps = parsed.latitude && parsed.longitude ? { lat: Number(parsed.latitude), lng: Number(parsed.longitude) } : null;
  // Selaraskan persis dengan REPORT_HEADERS di Apps Script (36 kolom).
  return [
    formatWib(input.createdAt ?? new Date()), parsed.nomorSpt || '-', categoryKey(input.kategori) === 'odnk' ? 'ODNK' : 'Kebakaran',
    parsed.tanggal || '-', parsed.hari || '-', parsed.lokasi || '-', parsed.latitude || '-', parsed.longitude || '-', parsed.googleMaps || '-',
    parsed.pelapor || '-', (parsed.pemilik || parsed.objek) || '-', parsed.penghuni || '-', parsed.korban || '-', parsed.penyebab || '-', parsed.kronologi || '-', parsed.tindakan || '-', parsed.kerugian || '-', parsed.hartaTerselamatkan || '-', parsed.luasArea || '-', parsed.jarakTempuh || '-', parsed.estimasiPerjalanan || '-', parsed.waktuLaporan || '-', parsed.waktuBerangkat || '-', parsed.waktuTiba || '-', parsed.waktuMulai || '-', parsed.waktuSelesai || '-', parsed.waktuKembali || '-', parsed.armada || '-', parsed.personil || '-', parsed.kendala || '-', parsed.rincianKegiatan || '-', input.rawText || '-', input.folderUrl || '', photos.length, 'DITERIMA', 'SILAKAR',
  ];
}

/** Baris log detail foto di sheet "Detail Foto". */
export function buildPhotoRow(options: PhotoRowInput): (string | number)[] {
  const meta = options.meta || {};
  const hasExifCoordinates = typeof meta.lat === 'number' && typeof meta.lng === 'number';
  const hasCoordinates = hasExifCoordinates || Boolean(options.fallbackLat !== undefined && options.fallbackLng !== undefined);
  const mapsLink = hasCoordinates ? `https://www.google.com/maps?q=${meta.lat},${meta.lng}` : '-';

  // Must match Apps Script PHOTO_HEADERS (17 columns).
  return [
    formatWib(options.createdAt ?? new Date()), options.idLaporan || '', options.kategori === 'odnk' ? 'ODNK' : 'Kebakaran', options.tanggal || '-',
    options.namaFile || '-', options.linkDrive || '', options.fileId || '', options.folderUrl || '',
    hasCoordinates ? (hasExifCoordinates ? (meta.lat as number) : options.fallbackLat!) : '-', hasCoordinates ? (hasExifCoordinates ? (meta.lng as number) : options.fallbackLng!) : '-',
    hasCoordinates ? `https://www.google.com/maps?q=${hasExifCoordinates ? meta.lat : options.fallbackLat},${hasExifCoordinates ? meta.lng : options.fallbackLng}` : '-', options.source === 'camera' ? 'KAMERA' : options.source === 'gallery' ? 'GALERI' : 'MOBILE',
    hasCoordinates ? 'YA' : 'TIDAK', meta.datetime || '-', meta.address || '-',
    options.ket || '-', 'DITERIMA',
  ];
}

/* ── Penulisan sheet ─────────────────────────────────────────────── */

async function appendRows(sheetName: string, rows: (string | number)[][]): Promise<void> {
  if (!rows.length) return;
  const spreadsheetId = getSpreadsheetId();
  try {
    await withSheetsFallback(sheets =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName.replace(/'/g, "''")}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rows },
      } as never),
    );
  } catch (error) {
    const status = (error as { code?: number; response?: { data?: { error?: { message?: string } } } })?.code;
    const detail = (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
    if (status === 404) {
      throw new Error(
        `Spreadsheet tidak ditemukan atau tidak dapat diakses. Periksa GOOGLE_SHEET_ID (${spreadsheetId}) dan pastikan akun OAuth/service account memiliki akses Editor. Pastikan tab ${sheetName} sudah dibuat oleh Apps Script. Detail Google: ${detail || 'NOT_FOUND'}`,
      );
    }
    throw error;
  }
}

/** Tulis baris laporan beserta seluruh detail foto dalam dua operasi. */
export async function saveReportWithPhotos(
  report: ReportRowInput,
  photos: PhotoRowInput[],
): Promise<void> {
  const category = categoryKey(report.kategori);
  await appendRows(SHEET.reports[category], [buildReportRow(report)]);
  if (photos.length) await appendRows(SHEET.photos[category], photos.map(buildPhotoRow));
}
