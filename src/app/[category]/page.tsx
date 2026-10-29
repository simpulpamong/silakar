import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppProvider } from '@/features/core/AppContext';
import SilakarReportPage from '@/features/silakar/SilakarReportPage';
import { CATEGORIES, getCategoryBySlug } from '@/lib/constants';

export function generateStaticParams() {
  return CATEGORIES.map(category => ({ category: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: 'Kategori tidak ditemukan' };
  return { title: `SILAKAR — ${category.name}`, description: category.description };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <AppProvider scope={category.slug}>
      <SilakarReportPage />
    </AppProvider>
  );
}
