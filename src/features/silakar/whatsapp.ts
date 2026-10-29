import { apiFetch } from '@/features/core/apiClient';

export async function resolveWhatsAppGroupUrl(): Promise<string> {
  try {
    const result = await apiFetch<{ url?: string }>('/api/silakar/whatsapp', { timeout: 8000 });
    return result.url || '';
  } catch {
    return '';
  }
}

export function buildWhatsAppMessage(report: string, folderUrl: string, photoCount: number): string {
  return [
    '*LAPORAN SILAKAR DAMKAR PONOROGO*',
    '',
    report.trim(),
    '',
    `*Dokumentasi (${photoCount} foto):*`,
    folderUrl || '(album dokumentasi belum tersedia)',
    '',
    'Laporan telah tersimpan di Google Drive dan Google Sheets.',
  ].join('\n');
}
