import CategoryCard from '@/components/CategoryCard';
import { CATEGORIES } from '@/lib/constants';

export default function NotFound() {
  return (
    <main className="landing">
      <div className="landing-hero">
        <span className="landing-mark">404</span>
        <p className="landing-kicker">Halaman tidak ditemukan</p>
        <h1>Alamat tidak dikenali</h1>
        <p className="landing-intro">
          Kategori laporan yang Anda cari tidak tersedia. Pilih salah satu jalur di bawah ini.
        </p>
      </div>

      <ul className="landing-grid">
        {CATEGORIES.map(category => (
          <li key={category.slug}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>
    </main>
  );
}
