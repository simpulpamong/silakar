import { getSpreadsheetId, withSheetsFallback } from './googleAuth';
import { parseReport } from '../parser/whatsapp/parser';
import { formatWib } from '../format';
import { REPORT_HEADERS as CONTRACT_REPORT_HEADERS, PHOTO_HEADERS as CONTRACT_PHOTO_HEADERS } from './schema-contract';
import { CATEGORY_CONFIG, resolveCategory, type ReportCategory } from './category-config';

export const SHEET = {
  reports: { kebakaran: CATEGORY_CONFIG.kebakaran.reportSheet, odnk: CATEGORY_CONFIG.odnk.reportSheet },
  photos: { kebakaran: CATEGORY_CONFIG.kebakaran.photoSheet, odnk: CATEGORY_CONFIG.odnk.photoSheet },
  narratives: { kebakaran: CATEGORY_CONFIG.kebakaran.narrativeSheet, odnk: CATEGORY_CONFIG.odnk.narrativeSheet },
} as const;

function categoryKey(category?: string): ReportCategory {
  return resolveCategory(category);
}

/** Jumlah kolom foto pada sheet INPUT (kolom M sampai V). */
export const PHOTO_COLUMNS = 10;

export { parseReport, buildPhotoFileName, parseIndonesianDate, mimeToExt } from '../parser/whatsapp/parser';
export type { ParsedReport } from '../parser/whatsapp/parser';

/* ── Struktur baris ─────────────────────────────────────────────── */

/** Canonical column order for both report tabs (KEBAKARAN and ODNK). */
export const REPORT_HEADERS = CONTRACT_REPORT_HEADERS;
export const PHOTO_HEADERS = CONTRACT_PHOTO_HEADERS;
export const NARRATIVE_HEADERS = ['Waktu Submit', 'ID Laporan', 'Kategori', 'Narasi Asli', 'Folder Drive'];

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
  reportId?: string;
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
    formatWib(input.createdAt ?? new Date()), input.reportId || parsed.nomorSpt || '-', categoryKey(input.kategori) === 'odnk' ? 'ODNK' : 'Kebakaran',
    parsed.tanggal || '-', parsed.hari || '-', parsed.lokasi || '-', parsed.latitude || '-', parsed.longitude || '-', parsed.googleMaps || '-',
    parsed.pelapor || '-', parsed.objek || '-', parsed.pemilik || '-', parsed.penghuni || '-', parsed.korban || '-', parsed.penyebab || '-', parsed.kronologi || '-', parsed.tindakan || '-', parsed.kerugian || '-', parsed.hartaTerselamatkan || '-', parsed.luasArea || '-', parsed.jarakTempuh || '-', parsed.estimasiPerjalanan || '-', parsed.waktuLaporan || '-', parsed.waktuBerangkat || '-', parsed.waktuTiba || '-', parsed.waktuMulai || '-', parsed.waktuSelesai || '-', parsed.waktuKembali || '-', parsed.jumlahArmada || '-', parsed.armada || '-', parsed.kendala || '-', parsed.rincianKegiatan || '-', parsed.personil || '-', parsed.yangMelaporkan || '-', input.folderUrl || '', photos.length, 'DITERIMA',
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

async function ensureSheetStructure(): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  await withSheetsFallback(async sheets => {
    const book = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false });
    const existing = new Map((book.data.sheets || []).map(sheet => [sheet.properties?.title || '', sheet.properties?.sheetId || 0]));
    const requests: any[] = [];
    for (const definition of [
      { title: SHEET.reports.kebakaran, headers: REPORT_HEADERS },
      { title: SHEET.reports.odnk, headers: REPORT_HEADERS },
      { title: SHEET.photos.kebakaran, headers: PHOTO_HEADERS },
      { title: SHEET.photos.odnk, headers: PHOTO_HEADERS },
      { title: SHEET.narratives.kebakaran, headers: NARRATIVE_HEADERS },
      { title: SHEET.narratives.odnk, headers: NARRATIVE_HEADERS },
    ]) {
      const sheetId = existing.get(definition.title);
      if (sheetId === undefined) requests.push({ addSheet: { properties: { title: definition.title } } });
    }
    if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    const refreshed = requests.length
      ? await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false })
      : book;
    const byTitle = new Map((refreshed.data.sheets || []).map(sheet => [sheet.properties?.title || '', sheet.properties?.sheetId || 0]));
    const values = [
      { title: SHEET.reports.kebakaran, headers: REPORT_HEADERS },
      { title: SHEET.reports.odnk, headers: REPORT_HEADERS },
      { title: SHEET.photos.kebakaran, headers: PHOTO_HEADERS },
      { title: SHEET.photos.odnk, headers: PHOTO_HEADERS },
      { title: SHEET.narratives.kebakaran, headers: NARRATIVE_HEADERS },
      { title: SHEET.narratives.odnk, headers: NARRATIVE_HEADERS },
    ];
    for (const definition of values) {
      const sheetId = byTitle.get(definition.title);
      if (!sheetId) continue;
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${definition.title.replace(/'/g, "''")}'!A1`, valueInputOption: 'RAW', requestBody: { values: [definition.headers] } });
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, title: definition.title, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } }, { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.12, green: 0.31, blue: 0.47 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } }] } });
    }
  });
}

async function appendRows(sheetName: string, rows: (string | number)[][]): Promise<void> {
  if (!rows.length) return;
  await ensureSheetStructure();
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (appsScriptUrl) {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'submit',
        token: process.env.APPS_SCRIPT_TOKEN || '',
        data: { reportId: String(rows[0][1] || ''), sheetName, rows, photoSheetName: undefined, photoRows: [] },
      }),
      cache: 'no-store',
    });
    const result = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || result.success === false) throw new Error(result.message || 'Apps Script gagal menulis spreadsheet.');
    return;
  }
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
  const reportRows = [buildReportRow(report)];
  const photoRows = photos.map(buildPhotoRow);
  const narrativeRows = [[formatWib(report.createdAt ?? new Date()), report.reportId || report.parsed.nomorSpt || '-', category === 'odnk' ? 'ODNK' : 'Kebakaran', report.rawText || report.parsed.keterangan || '-', report.folderUrl || '']];
  await appendRows(SHEET.reports[category], reportRows);
  if (photoRows.length) await appendRows(SHEET.photos[category], photoRows);
  await appendRows(SHEET.narratives[category], narrativeRows);
}
