import Link from 'next/link';
import type { CategoryDef } from '@/lib/constants';

/**
 * Kartu kategori pada menu utama: ilustrasi di kiri, nama + deskripsi di kanan.
 * Ilustrasi sudah dikompres ke WebP 256px (<25KB) di /public/assets/kategori.
 */
export default function CategoryCard({ category }: { category: CategoryDef }) {
  return (
    <Link
      className={`landing-card landing-tone-${category.tone}`}
      href={category.href}
      data-flow={category.flow}
    >
      <span className="landing-ico">
        <img
          src={category.image}
          alt=""
          width={256}
          height={256}
          loading="eager"
          decoding="async"
        />
      </span>
      <span className="landing-copy">
        <strong>{category.name}</strong>
      </span>
    </Link>
  );
}
