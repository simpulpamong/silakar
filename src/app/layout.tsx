import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Great_Vibes, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import ThemeFrameSync from '@/components/ThemeFrameSync';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: '400',
});

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-script',
  weight: '400',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#080d18',
};

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/assets/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/assets/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/assets/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    apple: [{ url: '/assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/assets/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
  other: { 'mobile-web-app-capable': 'yes' },
};

/**
 * Skrip kecil yang dipakai sebelum hydration agar tema tidak berkedip.
 *
 * Urutan prioritas:
 *  1. `?theme=` — dikirim halaman induk (dashboard SILAKAR) ketika aplikasi ini
 *     ditampilkan di dalam iframe, supaya tema sudah benar sejak byte pertama.
 *  2. Pilihan pengguna yang tersimpan di localStorage.
 *  3. Preferensi sistem (`prefers-color-scheme`).
 *  4. Bawaan aplikasi: gelap.
 *
 * `light-mode` hanya dipasang pada <html>; <body> belum ada saat skrip ini
 * jalan, sehingga menempel class di body akan membuat tema terlihat berkedip.
 */
const themeBootstrap = `(function(){try{
  var q=new URLSearchParams(location.search).get('theme');
  var r=localStorage.getItem('silakar:v5:settings');
  var s=r?JSON.parse(r).theme:null;
  var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  var t=(q==='dark'||q==='light')?q:((s==='light'||s==='dark')?s:sys);
  var light=t==='light';
  var d=document.documentElement;
  d.classList.toggle('light-mode',light);
  d.style.colorScheme=light?'light':'dark';
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.warn('[sw] pendaftaran service worker gagal', err);
                    });
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${bebasNeue.variable} ${greatVibes.variable}`}>
        <ThemeFrameSync />
        {children}
      </body>
    </html>
  );
}
