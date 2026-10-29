import type { MetadataRoute } from 'next';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080d18',
    theme_color: '#080d18',
    lang: 'id',
    dir: 'ltr',
    categories: ['productivity', 'utilities', 'government'],
    icons: [
      { src: '/assets/icon-16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Laporan Kebakaran', url: '/kebakaran' },
      { name: 'Laporan ODNK', url: '/odnk' },
      { name: 'SILAKARADMIN', url: '/admin' },
    ],
  };
}
