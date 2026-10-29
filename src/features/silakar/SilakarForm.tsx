'use client';

import Icon from '@/components/Icon';
import { useApp } from '../core/AppContext';
import { REPORT_TEMPLATES } from '@/lib/reportTemplates';

/** Formulir silakar: satu kolom teks laporan yang ditempel dari WhatsApp. */
export default function SilakarForm({ className = '' }: { className?: string }) {
  const { reportText, setReportText, scope } = useApp();
  const template = scope === 'odnk' ? REPORT_TEMPLATES.odnk : REPORT_TEMPLATES.kebakaran;
  const length = reportText.trim().length;

  return (
    <section className={className ? `card ${className}` : 'card'}>
      <div className="card-head">
        <span className="card-ico tone-blue">
          <Icon name="file" />
        </span>
        <h3>Teks Laporan Patroli</h3>
        <span className="badge">Wajib</span>
      </div>

      <div className="card-body">
        <textarea
          className="paste-field"
          value={reportText}
          onChange={event => setReportText(event.target.value)}
          placeholder="Tempel teks laporan patroli dari WhatsApp."
          rows={7}
          spellCheck={false}
          aria-label="Teks laporan patroli"
        />
        <div className="paste-meta">
          <span>{length.toLocaleString('id-ID')} karakter</span>
          <button type="button" className="link-btn" onClick={() => setReportText(template)}>
            Salin template kosong
          </button>
          {reportText && (
            <button type="button" className="link-btn" onClick={() => setReportText('')}>
              <Icon name="x" /> Bersihkan
            </button>
          )}
        </div>

      </div>
    </section>
  );
}
