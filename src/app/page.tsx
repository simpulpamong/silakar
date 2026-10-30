import type { Metadata } from 'next';
import CategoryLanding from '@/components/CategoryLanding';

export const metadata: Metadata = {
  title: 'SILAKAR - Sistem Pelaporan Pemadam Kebakaran',
};

export default function HomePage() {
  return <CategoryLanding />;
}
