'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/Icon';

interface ServiceViewerProps {
  src: string;
  title: string;
  frameTitle: string;
  icon: IconName;
}

export default function ServiceViewer({ src, title, frameTitle, icon }: ServiceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [online, setOnline] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      setLoading(false);
      setError(true);
    };
    const handleOnline = () => {
      setOnline(true);
      setLoading(true);
      setError(false);
      setAttempt(value => value + 1);
    };

    // Read the initial browser connectivity state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (!navigator.onLine) handleOffline();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [loading, attempt]);

  function retry() {
    if (!navigator.onLine) {
      setOnline(false);
      setError(true);
      setLoading(false);
      return;
    }
    setOnline(true);
    setError(false);
    setLoading(true);
    setAttempt(value => value + 1);
  }

  return (
    <main className="viewer">
      <div className="viewer-bar">
        <Link className="back-link solid" href="/">
          <Icon name="arrowLeft" /> Kembali
        </Link>
        <span className="viewer-title">
          <Icon name={icon} /> {title}
        </span>
      </div>
      <div className="viewer-frame">
        {loading && !error && (
          <div className="viewer-loading" role="status">
            <Icon name="loader" className="spin" />
            <span>Memuat {title}...</span>
          </div>
        )}
        {error && (
          <div className="viewer-error" role="alert">
            <Icon name="wifiOff" />
            <span>
              {online
                ? `${title} belum merespons atau sedang mengalami gangguan. Periksa koneksi, lalu coba lagi.`
                : 'Koneksi internet terputus. Sambungkan kembali ke internet, lalu coba lagi.'}
            </span>
            <div className="viewer-error-actions">
              <button className="viewer-retry-button" type="button" onClick={retry}>
                <Icon name="refresh" /> Coba lagi
              </button>
              {online && (
                <a className="viewer-retry-link" href={src} target="_blank" rel="noopener noreferrer">
                  Buka situs langsung <Icon name="externalLink" />
                </a>
              )}
            </div>
          </div>
        )}
        <iframe
          key={attempt}
          src={src}
          title={frameTitle}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={event => {
            const frame = event.currentTarget;
            window.setTimeout(() => {
              if (!frame.isConnected || !navigator.onLine) return;
              setLoading(false);
              setError(false);
            }, 350);
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          style={{ display: loading || error ? 'none' : 'block' }}
        />
      </div>
    </main>
  );
}