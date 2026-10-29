'use client';

import Image from 'next/image';
import Link from 'next/link';
import BatikBackdrop from './BatikBackdrop';
import CategoryCard from './CategoryCard';
import Icon from './Icon';
import { APP_NAME, APP_TAGLINE, CATEGORIES } from '@/lib/constants';
import { useTheme } from '@/lib/theme';

/**
 * Menu utama: dua kategori laporan SILAKAR.
 * Dilengkapi logo, branding, dan tombol toggle tema.
 */
export default function CategoryLanding() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <main className="landing">
      {/* Ornamen batik dekoratif - menyatu dengan gradient. Komponen yang
          sama dipakai di setiap halaman kategori laporan. */}
      <BatikBackdrop />

      <div className="landing-header">
        <div className="landing-header-actions">
          <button
            type="button"
            className="icon-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={mounted && theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
            aria-label={mounted && theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
          >
            <Icon name={mounted && theme === 'light' ? 'moon' : 'sun'} />
          </button>
        </div>
      </div>

      <div className="landing-hero">
        <div className="landing-brand">
          <div className="landing-logo">
            <Image
              src="/assets/icon-512.png"
              alt="Logo SILAKAR"
              width={72}
              height={72}
              priority
            />
          </div>
          <div className="landing-brand-text">
            <div className="landing-brand-line">
              <h1 className="landing-title">{APP_NAME}</h1>
              <span className="landing-badge">
                <Icon name="smartphone" /> Mobile
              </span>
            </div>
            <p className="landing-subtitle">{APP_TAGLINE.toUpperCase()}</p>
          </div>
        </div>
        <div className="landing-program">
          <h2 className="landing-heading">LAYANAN DAMKAR PONOROGO</h2>
          <p className="landing-region">Kabupaten Ponorogo</p>
        </div>
      </div>

      <ul className="landing-grid">
        {CATEGORIES.map(category => (
          <li key={category.slug}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>

      <section className="landing-other" aria-labelledby="landing-other-title">
        <div className="landing-other-heading">
          <h2 id="landing-other-title">Menu Lainnya</h2>
          <span />
        </div>
        <div className="landing-other-grid">
          <Link className="landing-other-card landing-other-admin" href="/admin">
            <span className="landing-other-icon">
              <img src="/assets/icon-full.webp" alt="" width="44" height="44" loading="lazy" decoding="async" />
            </span>
            <span className="landing-other-copy">
              <strong>SILAKAR ADMIN</strong>
            </span>
          </Link>

        </div>
      </section>

    </main>
  );
}
