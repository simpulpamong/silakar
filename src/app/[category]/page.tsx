import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/features/core/AppContext';
import SilakarReportPage from '@/features/silakar/SilakarReportPage';
import { CATEGORIES, getCategoryBySlug } from '@/lib/constants';

export function generateStaticParams() {
  return CATEGORIES.map(category => ({ category: category.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const category = getCategoryBySlug(params.category);
  if (!category) return { title: 'Kategori tidak ditemukan' };
  return { title: `SILAKAR — ${category.name}`, description: category.description };
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = getCategoryBySlug(params.category);
  if (!category) notFound();

  return (
    <AppProvider scope={category.slug}>
      <SilakarReportPage />
    </AppProvider>
  );
}
