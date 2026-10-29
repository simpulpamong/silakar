/**
 * Konstanta global aplikasi SILAKAR.
 * Satu sumber kebenaran untuk identitas aplikasi, kategori laporan, dan
 * metadata yang dipakai oleh server maupun client.
 */

export const APP_NAME = 'SILAKAR';
export const APP_VERSION = '1.0.0';
export const APP_TAGLINE = 'Sistem Laporan Kebakaran dan Non-Kebakaran';
export const APP_WILAYAH = 'Ponorogo, Jawa Timur';
export const APP_CONTACT_WA = '6285159686554';

/** Bagian wilayah yang selalu menutup alamat pada watermark & laporan. */
export const APP_KABUPATEN = 'Ponorogo';
export const APP_PROVINSI = 'Jawa Timur';
export const APP_NEGARA = 'Indonesia';

/** Titik pusat peta (kota Ponorogo) + zoom default saat memilih koordinat. */
export const MAP_DEFAULT = { lat: -7.8697, lng: 111.4708, zoom: 14 } as const;
/** Zoom saat koordinat sudah diketahui (dipakai modal peta). */
export const MAP_PICK_ZOOM = 18;
/** Batas akurasi GPS (meter) yang masih dianggap layak. */
export const GPS_MAX_ACCURACY_M = 100;

export const DEVELOPER_NAME = 'Ahmad Abdul Basith, S.Tr.I.P';
export const DEVELOPER_ROLE = 'Pengembang';
export const DEVELOPER_PHOTO = '/assets/icon-192.png';

/** Nama utama yang dicetak sebagai judul watermark foto, untuk semua kategori. */
export const WATERMARK_BRAND = 'DAMKAR PONOROGO';

/** Jenis alur kerja sebuah kategori. */
export type FlowKind = 'structured' | 'silakar';

export type CategoryTone = 'teal' | 'amber' | 'rose' | 'orange' | 'blue' | 'violet';

export interface CategoryDef {
  /** Slug URL, juga dipakai sebagai scope penyimpanan lokal. */
  slug: string;
  /** Label yang tampil di form dan di sheet. */
  name: string;
  description: string;
  href: string;
  tone: CategoryTone;
  flow: FlowKind;
  /** Penetapan fotos kopi otomatis untuk kategori tanpa label khusus. */
  photoHint: string;
  /** Ilustrasi kartu menu (WebP, 256px, <25KB). */
  image: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'kebakaran',
    name: 'Kebakaran',
    description: 'Laporan pemadaman dan penanganan kebakaran',
    href: '/kebakaran',
    tone: 'orange',
    flow: 'silakar',
    photoHint: 'Foto lokasi dan dokumentasi pemadaman',
    image: '/assets/kategori/kebakaran.webp',
  },
  {
    slug: 'odnk',
    name: 'ODNK (Non-Kebakaran)',
    description: 'Laporan evakuasi, rescue, dan kejadian non-kebakaran',
    href: '/odnk',
    tone: 'teal',
    flow: 'silakar',
    photoHint: 'Foto lokasi dan dokumentasi penanganan',
    image: '/assets/kategori/odnk.webp',
  },
];

/** Kategori dengan alur form terstruktur (kecuali silakar). */
export const STRUCTURED_CATEGORIES = CATEGORIES.filter(category => category.flow === 'structured');

export const SILAKAR_CATEGORY = CATEGORIES.find(category => category.flow === 'silakar')!;

/** Nama kategori yang boleh diterima server (sinkron dengan validasi API). */
export const STRUCTURED_NAMES: string[] = STRUCTURED_CATEGORIES.map(category => category.name);

export function getCategoryBySlug(slug: string): CategoryDef | undefined {
  return CATEGORIES.find(category => category.slug === slug);
}

export function getCategoryByName(name: string): CategoryDef | undefined {
  return CATEGORIES.find(category => category.name === name);
}

/** Batas jumlah foto per laporan. */
export const MAX_PHOTOS = 10;

/** Batas ukuran foto setelah diproses (KB). */
export const MAX_PHOTO_KB = 400;

/** Batas ukuran payload server (bytes) — 1 foto per request. */
export const MAX_UPLOAD_BYTES = 400 * 1024;
