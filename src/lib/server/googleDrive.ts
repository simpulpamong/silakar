import { Readable } from 'stream';
import { getMainFolderId, withDriveFallback } from './googleAuth';

export { formatDateFolder, formatMonthFolder, mimeToExt } from '../silakarParser';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const APPS_SCRIPT_TIMEOUT_MS = 25_000;

function getDeveloperEmail(): string {
  return process.env.DEVELOPER_EMAIL || '';
}

/**
 * Cache folder per instance server.
 * Peta `folderPending` mencegah belasan request paralel membuat folder kembar
 * saat beberapa foto diunggah bersamaan.
 */
const folderCache = new Map<string, string>();
const folderPending = new Map<string, Promise<string>>();

/** Beri akses publik agar hasil bisa dipratinjau tanpa login. */
async function shareReader(fileId: string): Promise<void> {
  try {
    await withDriveFallback(drive =>
      drive.permissions.create({
        fileId,
        supportsAllDrives: true,
        resource: { role: 'reader', type: 'anyone' },
      } as never),
    );
  } catch (error) {
    console.warn('[drive] gagal memberi akses reader', fileId, (error as Error).message);
  }
}

async function shareDeveloper(fileId: string): Promise<void> {
  const email = getDeveloperEmail();
  if (!email) return;
  try {
    await withDriveFallback(drive =>
      drive.permissions.create({
        fileId,
        supportsAllDrives: true,
        resource: { role: 'writer', type: 'user', emailAddress: email },
      } as never),
    );
  } catch (error) {
    console.warn('[drive] gagal berbagi folder ke developer', (error as Error).message);
  }
}

async function createSharedFolder(parentId: string, name: string): Promise<string> {
  const folder = await withDriveFallback(drive =>
    drive.files.create({
      supportsAllDrives: true,
      resource: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id',
    } as never),
  );

  const folderId = folder.data.id!;
  await shareReader(folderId);
  await shareDeveloper(folderId);
  return folderId;
}

/**
 * Ambil folder anak, buat bila belum ada.
 * Aman dipanggil bersamaan: permintaan paralel berbagi satu promise.
 */
export function getOrCreateFolder(parentId: string, name: string): Promise<string> {
  const key = `${parentId}::${name}`;
  const cached = folderCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = folderPending.get(key);
  if (pending) return pending;

  const task = (async () => {
    const escaped = name.replace(/'/g, "\\'");
    const listed = await withDriveFallback(drive =>
      drive.files.list({
        q: `'${parentId}' in parents and name = '${escaped}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 1,
      } as never),
    );

    const found = listed.data.files?.[0]?.id;
    if (found) {
      folderCache.set(key, found);
      return found;
    }

    const created = await createSharedFolder(parentId, name);
    folderCache.set(key, created);
    return created;
  })().finally(() => {
    folderPending.delete(key);
  });

  folderPending.set(key, task);
  return task;
}

export interface UploadResult {
  linkFile: string;
  fileId: string;
  folderId: string;
  folderUrl: string;
  fileName: string;
  storage: 'apps-script' | 'next';
}

export interface UploadOptions {
  folderMonth: string;
  folderDate: string;
  fileName: string;
  mime: string;
  category?: string;
  reportId?: string;
  /** Data URL berisi foto. */
  dataUrl: string;
}

/**
 * Unggah satu foto ke Drive dan kembalikan link publik + link folder.
 * Memakai Apps Script bila tersedia, dengan fallback otomatis ke Drive API.
 */
/**
 * Unggah satu foto ke Drive dan kembalikan link publik + link folder.
 *
 * Apps Script dicoba lebih dulu bila dikonfigurasi (lebih cepat), tetapi
 * kegagalan apa pun — deployment mati, kuota habis, timeout — dialihkan ke
 * Drive API. Dengan begitu upload tidak pernah gagal hanya karena satu
 * layanan bantu bermasalah.
 */
export async function uploadPhotoToDateFolder(options: UploadOptions): Promise<UploadResult> {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (appsScriptUrl) {
    try {
      return await uploadViaAppsScript(appsScriptUrl, options);
    } catch (error) {
      console.warn(
        '[drive] Apps Script gagal, beralih ke Drive API:',
        (error as Error).message,
      );
    }
  }
  return uploadViaDriveApi(options);
}

async function uploadViaAppsScript(
  endpoint: string,
  options: UploadOptions,
): Promise<UploadResult> {
  const comma = options.dataUrl.indexOf(',');
  const base64 = comma >= 0 ? options.dataUrl.slice(comma + 1) : options.dataUrl;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'upload',
        token: process.env.APPS_SCRIPT_TOKEN || '',
        category: options.category || 'Kebakaran',
        date: options.folderDate,
        reportId: options.reportId || '',
        folderId: getMainFolderId(),
        folderBulan: options.folderMonth,
        folderName: options.folderDate,
        fileData: { content: base64, mimeType: options.mime, name: options.fileName },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Apps Script gagal (status ${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`,
      );
    }

    const result = (await response.json()) as {
      success?: boolean;
      message?: string;
      url?: string;
      linkFile?: string;
      folderUrl?: string;
      fileId?: string;
      folderId?: string;
    };

    if (result?.success === false) {
      throw new Error(result.message || 'Apps Script menolak unggahan.');
    }

    const linkFile = result.url || result.linkFile || '';
    const folderUrl = result.folderUrl || '';
    if (!linkFile) throw new Error('Apps Script tidak mengembalikan URL berkas.');
    if (!folderUrl) throw new Error('Apps Script tidak mengembalikan URL folder.');

    return { linkFile, fileId: result.fileId || '', folderId: result.folderId || '', folderUrl, fileName: options.fileName, storage: 'apps-script' };
  } finally {
    clearTimeout(timer);
  }
}

/** Pesan yang bisa ditindaklanjuti saat service account kehabisan kuota Drive. */
function describeDriveAuthError(error: unknown): never {
  const message = String((error as Error)?.message || error);
  if (/do not have storage quota|shared drives/i.test(message)) {
    const hasOAuth = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REFRESH_TOKEN,
    );
    throw new Error(
      hasOAuth
        ? 'Akun Google yang dipakai tidak punya kuota penyimpanan Drive. Gunakan akun berbayar atau folder Shared Drive.'
        : 'Service account tidak punya kuota penyimpanan Drive. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_REFRESH_TOKEN agar upload memakai akun Anda sendiri.',
    );
  }
  throw error;
}

async function uploadViaDriveApi(options: UploadOptions): Promise<UploadResult> {
  const rootId = getMainFolderId();
  const monthId = await getOrCreateFolder(rootId, options.folderMonth);
  const dateId = await getOrCreateFolder(monthId, options.folderDate);

  const comma = options.dataUrl.indexOf(',');
  const base64 = comma >= 0 ? options.dataUrl.slice(comma + 1) : options.dataUrl;
  const buffer = Buffer.from(base64, 'base64');

  let fileId: string;
  try {
    const file = await withDriveFallback(drive =>
      drive.files.create({
        supportsAllDrives: true,
        resource: { name: options.fileName, parents: [dateId] },
        media: { mimeType: options.mime || 'image/jpeg', body: Readable.from(buffer) },
        fields: 'id',
      } as never),
    );
    fileId = file.data.id!;
  } catch (error) {
    describeDriveAuthError(error);
  }

  await shareReader(fileId);

  return {
    linkFile: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
    fileId,
    folderId: dateId,
    folderUrl: `https://drive.google.com/drive/folders/${dateId}`, 
    fileName: options.fileName,
    storage: 'next',
  };
}
