/** Parser laporan operasional Damkar dari format WhatsApp. */
const MONTH_INDEX: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

// Identitas bersifat opsional karena laporan evakuasi/non-kebakaran dapat memakai
// objek (mis. Kucing) dan laporan kebakaran dapat tidak mencantumkan pemilik.
export const REQUIRED_FIELDS = ['lokasi', 'hari', 'tanggal', 'personil', 'danru'] as const;
export type ReportField = (typeof REQUIRED_FIELDS)[number];
export const FIELD_LABELS: Record<ReportField, string> = {
  lokasi: 'Lokasi kejadian', hari: 'Hari', tanggal: 'Tanggal',
  personil: 'Personil Damkar', danru: 'Regu / Danru',
};

export function cleanReportText(text: string): string {
  return String(text || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\*_~`]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*•\s*/g, '\n')
    .replace(/\s+(?=\*(?:HARI|LOKASI|JARAK|ESTIMAS|PEMBERI|PELAPOR|PEMILIK|JUMLAH|LUAS|KORBAN|PENYEBAB|KRONOLOGI|TINDAKAN|KERUGIAN|RINCIAN|JUMLAH ARMADA|KENDALA|PERSONIL|DOKUMENTASI|YANG MELAPORKAN|TEMBUSAN)\b)/gi, '\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function first(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim().replace(/[.*]+$/, '').trim();
  }
  return '';
}
function section(text: string, labels: string[], stops: string[]): string {
  const label = labels.join('|');
  const stop = stops.join('|');
  return first(text, [new RegExp(`(?:^|\\n)\\s*(?:[•.\\-]\\s*)?(?:${label})\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${stop})\\b|$)`, 'im')]);
}
function normalizeDay(value: string): string {
  return value.replace(/,.*$/, '').trim();
}

export interface ParsedReport {
  nomorSpt: string; lokasi: string; hari: string; tanggal: string;
  identitas: string; pelapor: string; pemilik: string; objek: string; penghuni: string;
  latitude: string; longitude: string; googleMaps: string;
  korban: string; penyebab: string; kronologi: string; tindakan: string;
  kerugian: string; hartaTerselamatkan: string; luasArea: string;
  jarakTempuh: string; estimasiPerjalanan: string; waktuLaporan: string;
  waktuBerangkat: string; waktuTiba: string; waktuMulai: string;
  waktuSelesai: string; waktuKembali: string; armada: string;
  personil: string; danru: string; namaDanru: string; kendala: string;
  rincianKegiatan: string; keterangan: string; missing: ReportField[];
}

export function parseReport(rawText: string): ParsedReport {
  const text = cleanReportText(rawText);
  const tanggalFull = first(text, [
    /HARI\s*(?:DAN\s+)?TANGGAL(?:\s+PELAKSANAANNYA|\s+PELAKSANAAN)?\s*[:：]?\s*([A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)?\s*,?\s*\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/i,
    /(?:^|\n)\s*Tanggal\s*[:：]?\s*([^\n]+)/i,
  ]);
  const dayFromDate = first(tanggalFull, [/^([A-Za-zÀ-ÿ]+)/]);
  const lokasi = section(text, ['LOKASI', 'ALAMAT'], ['GPS', 'JARAK', 'ESTIMAS', 'PEMBERI', 'PELAPOR', 'PEMILIK', 'KORBAN', 'PENYEBAB', 'KRONOLOGI', 'TINDAKAN', 'RINCIAN']);
  const personil = section(text, ['PERSONIL(?:\s+YANG\s+TERLIBAT)?'], ['PELAKSANAAN', 'DOKUMENTASI', 'YANG MELAPORKAN', 'TEMBUSAN', 'DEMIKIAN', 'KENDALA']);
  const regu = first(text, [
    /Regu\s+([A-Z])\s+Damkar/i,
    /Komandan\s+Regu\s+([A-Z])/i,
    /\b(Regu\s+[A-Z])\b/i,
  ]);
  const commander = first(text, [
    /\*?([A-ZÀ-Ý][A-ZÀ-Ý .,'-]{2,})\*?\s*Komandan\s+Regu/i,
    /YANG\s+MELAPORKAN\s*[:：]?\s*([A-Za-zÀ-ÿ .,'-]+)/i,
  ]);
  const identitas = section(text, ['OBJEK', 'PEMILIK(?:\s+NYA)?', 'IDENTITAS(?:\s*/\s*NAMA)?', 'PELAPOR(?:\s*/\s*PEMOHON)?'], ['JUMLAH', 'LUAS', 'KORBAN', 'PENYEBAB', 'KRONOLOGI', 'TINDAKAN', 'KERUGIAN', 'RINCIAN', 'PERSONIL']);
  const stop = ['JARAK', 'ESTIMAS', 'PEMBERI', 'PELAPOR', 'PEMILIK', 'JUMLAH', 'LUAS', 'KORBAN', 'PENYEBAB', 'KRONOLOGI', 'KERUGIAN', 'HARTA', 'TINDAKAN', 'RINCIAN', 'ARMADA', 'PERSONIL', 'KENDALA', 'DOKUMENTASI', 'DEMIKIAN', 'YANG MELAPORKAN'];
  const parsed: ParsedReport = {
    nomorSpt: first(text, [/Nomor\s*SPT\s*[:：]?\s*([^\n]+)/i]), lokasi, hari: normalizeDay(dayFromDate || first(text, [/\bHari\b\s*[:：]?\s*([A-Za-zÀ-ÿ]+)/i])),
    tanggal: tanggalFull.replace(/^[A-Za-zÀ-ÿ]+\s*,?\s*/i, '').trim(), identitas,
    objek: section(text, ['OBJEK'], stop), latitude: first(text, [/GPS\s*([-+]?\d+(?:\.\d+)?)\s*S/i]), longitude: first(text, [/GPS[^\n,]*,\s*([-+]?\d+(?:\.\d+)?)\s*E/i]), googleMaps: '',
    pelapor: section(text, ['PEMBERI INFORMASI.*', 'PELAPOR(?:\s*/\s*PEMOHON)?'], stop), pemilik: section(text, ['PEMILIK'], stop),
    penghuni: section(text, ['JUMLAH PENGHUNI'], stop), korban: section(text, ['KORBAN'], stop),
    penyebab: section(text, ['PENYEBAB'], stop), kronologi: section(text, ['KRONOLOGI'], stop),
    tindakan: section(text, ['TINDAKAN'], stop), kerugian: section(text, ['PERKIRAAN KERUGIAN', 'KERUGIAN'], stop),
    hartaTerselamatkan: section(text, ['PERKIRAAN HARTA.*TERSELAMATKAN'], stop), luasArea: section(text, ['LUAS AREA', 'AREAL YANG TERBAKAR'], stop),
    jarakTempuh: section(text, ['JARAK TEMPUH'], stop), estimasiPerjalanan: section(text, ['ESTIMASI WAKTU'], stop),
    waktuLaporan: section(text, ['LAPORAN MASUK'], stop), waktuBerangkat: section(text, ['WAKTU BERANGKAT'], stop), waktuTiba: section(text, ['TIBA DI LOKASI', 'TIBA DILOKASI'], stop),
    waktuMulai: section(text, ['MULAI KEGIATAN'], stop), waktuSelesai: section(text, ['SELESAI KEGIATAN'], stop), waktuKembali: section(text, ['TIBA KEMBALI'], stop),
    armada: section(text, ['JUMLAH UNIT KENDARAAN'], ['PERSONIL', 'KENDALA', 'DOKUMENTASI']), personil, danru: regu ? `Regu ${regu.replace(/^Regu\s+/i, '')}` : '', namaDanru: commander,
    kendala: section(text, ['KENDALA'], stop), rincianKegiatan: section(text, ['RINCIAN KEGIATAN'], stop),
    keterangan: section(text, ['KRONOLOGI'], ['PERKIRAAN KERUGIAN', 'TINDAKAN', 'RINCIAN KEGIATAN', 'DOKUMENTASI']), missing: [],
  };
  parsed.googleMaps = parsed.latitude && parsed.longitude ? `https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}` : '';
  if (!parsed.pelapor && parsed.identitas) parsed.pelapor = parsed.identitas;
  if (!parsed.identitas && parsed.objek) parsed.identitas = parsed.objek;
  parsed.missing = REQUIRED_FIELDS.filter((field) => !parsed[field]);
  return parsed;
}

/** Tanggal Indonesia ("Sabtu, 26 September 2026") menjadi Date. */
export function parseIndonesianDate(value: string): Date | null {
  if (!value) return null;
  const normalized = value.replace(/^[A-Za-z]+,?\s*/i, '').trim().toLowerCase();
  const long = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/.exec(normalized);
  if (long && MONTH_INDEX[long[2]] !== undefined) {
    return new Date(Number(long[3]), MONTH_INDEX[long[2]], Number(long[1]));
  }
  const short = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(value);
  if (short) {
    return new Date(Number(short[3]), Number(short[2]) - 1, Number(short[1]));
  }
  return null;
}

/** Nama berkas foto di Drive, mis. "[KAMERA]_26 September 2026_Suyatno_1.jpg". */
export function buildPhotoFileName(options: {
  source: string;
  date: Date;
  namaDanru?: string;
  index: number;
  total: number;
  extension: string;
}): string {
  const prefix = options.source === 'camera' ? '[KAMERA]' : '[GALERI]';
  const person = options.namaDanru
    ? '_' + options.namaDanru.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
    : '';
  const suffix = options.total > 1 ? `_${options.index}` : '';
  return `${prefix}_${formatDateFolder(options.date)}${person}${suffix}${options.extension}`;
}

const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function formatMonthFolder(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateFolder(date: Date): string {
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/bmp': '.bmp',
  };
  return map[(mime || '').toLowerCase()] || '.jpg';
}
