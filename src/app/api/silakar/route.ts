import {
  buildPhotoFileName,
  FIELD_LABELS,
  formatDateFolder,
  formatMonthFolder,
  mimeToExt,
  parseIndonesianDate,
  parseReport,
} from '@/lib/silakarParser';
import { uploadPhotoToDateFolder } from '@/lib/server/googleDrive';
import { saveReportWithPhotos, type PhotoLink } from '@/lib/server/googleSheets';
import { deleteDraft, getDraft } from '@/lib/server/drafts';
import { ApiError, ok, readJson, route, str } from '@/lib/server/http';
import { MAX_PHOTOS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TEXT = 20_000;
const MAX_PHOTO_CHARS = 6 * 1024 * 1024;

interface SilakarBody {
  action?: string;
  data?: {
    foto?: { data?: string; mime?: string; source?: string };
    meta?: Record<string, unknown> | null;
    laporan?: string;
    noFoto?: number;
    jumlahTotal?: number;
    linkFoto?: unknown[];
    folderUrl?: string;
    draftId?: string | null;
    reportId?: string;
    kategori?: 'kebakaran' | 'odnk';
  };
}

/** Endpoint aksi untuk alur Silakar: foto → Drive, data → Spreadsheet. */
export async function POST(request: Request) {
  return route(async () => {
    const body = await readJson<SilakarBody>(request);

    switch (body.action) {
      case 'uploadFoto':
        return uploadFoto(body);
      case 'submitLaporan':
        return submitLaporan(body);
      default:
        throw new ApiError(
          `Aksi tidak dikenal: ${body.action || '(kosong)'}`,
          400,
          'unknown_action',
        );
    }
  });
}

async function uploadFoto(body: SilakarBody) {
  const foto = body.data?.foto;
  const dataUrl = typeof foto?.data === 'string' ? foto.data : '';

  if (!dataUrl.startsWith('data:image/')) {
    throw new ApiError('Data foto tidak valid.', 400, 'invalid_photo');
  }
  if (dataUrl.length > MAX_PHOTO_CHARS) {
    throw new ApiError('Ukuran foto melebihi batas upload.', 413, 'payload_too_large');
  }

  const source = foto?.source === 'camera' ? 'camera' : 'gallery';
  const mime = str(foto?.mime, 60) || 'image/jpeg';
  const total = clamp(Number(body.data?.jumlahTotal) || 1, 1, MAX_PHOTOS);
  const index = clamp(Number(body.data?.noFoto) || 1, 1, MAX_PHOTOS);

  const parsed = parseReport(str(body.data?.laporan, MAX_TEXT));
  const reportDate = parseIndonesianDate(parsed.tanggal) ?? new Date();

  const fileName = buildPhotoFileName({
    source,
    date: reportDate,
    namaDanru: parsed.namaDanru,
    index,
    total,
    extension: mimeToExt(mime),
  });

  const result = await uploadPhotoToDateFolder({
    folderMonth: formatMonthFolder(reportDate),
    folderDate: formatDateFolder(reportDate),
    fileName,
    mime,
    dataUrl,
  });

  return ok({
    linkFile: result.linkFile,
    fileId: result.fileId,
    folderId: result.folderId,
    namaFile: result.fileName,
    folderUrl: result.folderUrl,
    noFoto: index,
    storage: result.storage,
  });
}

async function submitLaporan(body: SilakarBody) {
  const laporan = str(body.data?.laporan, MAX_TEXT);
  if (!laporan) {
    throw new ApiError('Teks laporan kosong. Tempel teks laporan lebih dulu.', 400, 'empty_report');
  }

  const parsed = parseReport(laporan);
  if (parsed.missing.length) {
    const labels = parsed.missing.map(field => FIELD_LABELS[field]).join(', ');
    throw new ApiError(`Bagian laporan belum lengkap: ${labels}. Lengkapi lalu kirim ulang.`, 400, 'incomplete_report');
  }

  const links = normalizePhotoLinks(body.data?.linkFoto);
  if (!links.length || links.length > MAX_PHOTOS) {
    throw new ApiError(`Jumlah foto harus antara 1 dan ${MAX_PHOTOS}.`, 400, 'invalid_photo_count');
  }

  const folderUrl = str(body.data?.folderUrl, 500);
  const categoryCode = body.data?.kategori === 'odnk' ? 'ODNK' : 'KEBAKARAN';
  const submitDate = new Date();
  const dateCode = `${submitDate.getFullYear()}${String(submitDate.getMonth() + 1).padStart(2, '0')}${String(submitDate.getDate()).padStart(2, '0')}`;
  const reportId = str(body.data?.reportId, 100) || `SLK-${categoryCode}-01/${String(submitDate.getDate()).padStart(2, '0')}${String(submitDate.getMonth() + 1).padStart(2, '0')}${submitDate.getFullYear()}`;

  await saveReportWithPhotos(
    { parsed, photos: links, folderUrl, kategori: body.data?.kategori, rawText: laporan },
    links.map(photo => ({
      idLaporan: reportId,
      kategori: body.data?.kategori,
      tanggal: parsed.tanggal,
      danru: parsed.namaDanru || parsed.danru || '-',
      namaFile: photo.namaFile,
      source: photo.source || 'camera',
      meta: photo.meta,
      linkDrive: photo.link,
      fileId: photo.fileId,
      folderId: photo.folderId,
      folderUrl: photo.folderUrl || folderUrl,
      fallbackLat: parsed.latitude ? Number(parsed.latitude) : undefined,
      fallbackLng: parsed.longitude ? Number(parsed.longitude) : undefined,
      ket: describePhoto(photo),
    })),
  );

  // Draft adalah salinan sementara: hapus setelah laporan resmi tersimpan,
  // tetapi hanya bila jumlah foto sama agar tidak ada data yang hilang.
  const draftId = str(body.data?.draftId, 80);
  let draftRemoved = false;
  if (draftId) {
    const draft = await getDraft(draftId);
    if (draft.exists && draft.jumlahFoto === links.length) {
      await deleteDraft(draftId);
      draftRemoved = true;
    }
  }

  return ok({
    jumlahFoto: links.length,
    draftRemoved,
    ringkasan: {
      lokasi: parsed.lokasi,
      hari: parsed.hari,
      tanggal: parsed.tanggal,
      danru: parsed.danru,
      namaDanru: parsed.namaDanru,
    },
    whatsapp: {
      message: responseMessage(laporan, links.length, folderUrl),
      folderUrl,
      ready: true,
    },
  });
}

function responseMessage(
  laporan: string,
  photoCount: number,
  folderUrl: string,
) {
  const lines = [
    '*LAPORAN SILAKAR DAMKAR PONOROGO*',
    '',
    laporan.trim(),
    '',
    `*Dokumentasi (${photoCount} foto):*`,
    folderUrl || '(album dokumentasi belum tersedia)',
    '',
    'Laporan tersimpan di Google Drive dan Google Sheets.',
  ];
  return lines.join('\n');
}

function normalizePhotoLinks(value: unknown): PhotoLink[] {
  if (!Array.isArray(value)) return [];
  const links: PhotoLink[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const link = item.trim();
      if (link) links.push({ link, namaFile: link.split('/').pop() || 'foto' });
      continue;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const link = str(record.link || record.url, 500);
      if (!link) continue;
      links.push({
        link,
        namaFile: str(record.namaFile, 200) || link.split('/').pop() || 'foto',
        source: str(record.source, 20) || 'camera',
        meta: (record.meta as PhotoLink['meta']) ?? null,
        fileId: str(record.fileId, 200),
        folderId: str(record.folderId, 200),
        folderUrl: str(record.folderUrl, 500),
      });
    }
  }
  return links;
}

function describePhoto(photo: PhotoLink): string {
  const source = photo.source === 'camera' ? 'kamera' : 'galeri';
  if (photo.meta?.hasGps) {
    return source === 'kamera'
      ? 'Foto kamera dengan GPS. Koordinat terverifikasi.'
      : 'Foto galeri dengan deteksi lokasi otomatis via OCR.';
  }
  return source === 'kamera'
    ? 'Foto kamera tanpa data GPS EXIF.'
    : 'Foto galeri. Lokasi dari input manual.';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}
