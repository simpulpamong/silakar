import type { Metadata } from 'next';
import { AppProvider } from '@/features/core/AppContext';
import SilakarReportPage from '@/features/silakar/SilakarReportPage';
import { CATEGORIES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'SILAKAR — Laporan',
  description: 'Tempel teks laporan patroli dan kirim foto ke Google Drive serta Spreadsheet.',
};

export default function SilakarPage() {
  return (
    <AppProvider scope={CATEGORIES[0].slug}>
      <SilakarReportPage />
    </AppProvider>
  );
}
