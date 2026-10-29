import { NextResponse } from 'next/server';

/** Batas payload per request untuk satu foto (≈ ≤ 400 KB setelah diproses). */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

export type ApiOk<T> = { success: true } & T;
export type ApiFail = { success: false; message: string; code?: string };

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data } as ApiOk<T>, { status });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, message, code } as ApiFail, { status });
}

export class ApiError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Ubah error tak terduga menjadi pesan yang aman ditampilkan ke pengguna. */
export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.code);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error('[api]', error);
  return fail(`Kesalahan server: ${message}`, 500);
}

/** Bungkus handler route agar error tidak bocor sebagai 500 tanpa pesan. */
export async function route(handler: () => Promise<NextResponse>) {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Baca body JSON dengan batas ukuran dan pesan error yang jelas. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared && declared > MAX_BODY_BYTES) {
    throw new ApiError('Data yang dikirim terlalu besar.', 413, 'payload_too_large');
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ApiError('Permintaan tidak dapat dibaca.', 400);
  }

  if (text.length > MAX_BODY_BYTES) {
    throw new ApiError('Data yang dikirim terlalu besar.', 413, 'payload_too_large');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Format data tidak valid.', 400, 'invalid_json');
  }
}

export function str(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
