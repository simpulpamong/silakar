import ServiceViewer from '@/components/ServiceViewer';

export const dynamic = 'force-dynamic';

function resolveAdminUrl(): string {
  const raw = process.env.SILAKAR_ADMIN_URL || 'https://silakaradmin.vercel.app/';
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : 'https://silakaradmin.vercel.app/';
  } catch {
    return 'https://silakaradmin.vercel.app/';
  }
}

export default function AdminPage() {
  return <ServiceViewer src={resolveAdminUrl()} title="SILAKAR ADMIN" frameTitle="SILAKAR ADMIN" icon="shield" />;
}