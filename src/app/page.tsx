import type { Metadata } from 'next';
import CategoryLanding from '@/components/CategoryLanding';

export const metadata: Metadata = {
  title: 'SILAKAR - Sistem Laporan Kebakaran dan Non-Kebakaran',
};

export default function HomePage() {
  return <CategoryLanding />;
}
