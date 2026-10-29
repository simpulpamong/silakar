'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Crosshair, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CustomScrollArea from './CustomScrollArea';
import { MONTHS_LONG, toDateInputValue } from '@/lib/format';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const YEAR_WINDOW = 4;

function formatLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Pemilih tanggal ringkas: bulan/tahun + kalender, tanpa dependensi luar. */
export default function DatePicker({
  value,
  onChange,
  label = 'Tanggal',
  required = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<'month' | 'year' | null>(null);
  const [view, setView] = useState(() => startOfMonth(value, today));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setView(startOfMonth(value, today));
  }, [value, today]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActivePicker(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activePicker) setActivePicker(null);
        else setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, activePicker]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const todayValue = toDateInputValue(today);
  const minYear = today.getFullYear() - (YEAR_WINDOW - 1);
  const years = Array.from({ length: YEAR_WINDOW }, (_, index) => today.getFullYear() - index);

  const cells = useMemo(() => {
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: leading + total }, (_, index) =>
      index < leading ? null : index - leading + 1,
    );
  }, [year, month]);

  const pick = (day: number) => {
    onChange(iso(year, month, day));
    setActivePicker(null);
    setOpen(false);
  };

  return (
    <div className="form-field date-picker" ref={rootRef}>
      <span>
        {label} {required && <b>*</b>}
      </span>

      <button
        type="button"
        className={`date-trigger${value ? ' has-value' : ''}`}
        onClick={() => {
          setOpen(current => !current);
          setActivePicker(null);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarDays aria-hidden="true" />
        <span>{value ? formatLabel(value) : 'Pilih tanggal'}</span>
        <span className="date-tools">
          {value && !required && (
            <button
              type="button"
              className="date-clear"
              aria-label="Kosongkan tanggal"
              onClick={event => {
                event.stopPropagation();
                onChange('');
                setOpen(false);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange('');
                  setOpen(false);
                }
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
          <ChevronRight aria-hidden="true" className="date-caret" />
        </span>
      </button>

      {open && (
        <div className="date-panel" role="dialog" aria-label="Pilih tanggal">
          <div className="date-panel-head">
            <span className="ico">
              <CalendarDays aria-hidden="true" />
            </span>
            <span>
              <small>Pilih tanggal</small>
              <strong>{value ? formatLabel(value) : 'Laporan lapangan'}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setActivePicker(null);
              }}
              aria-label="Tutup kalender"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="date-period">
            <DateChoice
              id="date-month-options"
              label="Pilih bulan"
              value={month}
              options={MONTHS_LONG.map((name, index) => ({ label: name, value: index }))}
              open={activePicker === 'month'}
              onToggle={() => setActivePicker(current => (current === 'month' ? null : 'month'))}
              onChange={selectedMonth => {
                setView(new Date(year, selectedMonth, 1));
                setActivePicker(null);
              }}
            />
            <button
              type="button"
              className="date-step"
              disabled={year === minYear && month === 0}
              onClick={() => {
                setActivePicker(null);
                setView(new Date(year, month - 1, 1));
              }}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <DateChoice
              id="date-year-options"
              label="Pilih tahun"
              value={year}
              options={years.map(option => ({ label: String(option), value: option }))}
              open={activePicker === 'year'}
              onToggle={() => setActivePicker(current => (current === 'year' ? null : 'year'))}
              onChange={selectedYear => {
                setView(new Date(selectedYear, month, 1));
                setActivePicker(null);
              }}
            />
          </div>

          <div className="date-grid dow">
            {WEEKDAYS.map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-grid day">
            {cells.map((day, index) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  className={`${value === iso(year, month, day) ? 'picked ' : ''}${
                    iso(year, month, day) === todayValue ? 'today' : ''
                  }`}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              ) : (
                <span key={`blank-${index}`} />
              ),
            )}
          </div>

          <div className="date-panel-foot">
            <button
              type="button"
              className="date-today"
              onClick={() => {
                onChange(todayValue);
                setView(startOfMonth(todayValue, today));
                setActivePicker(null);
                setOpen(false);
              }}
            >
              <Crosshair aria-hidden="true" /> Hari ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateChoice({
  id,
  label,
  value,
  options,
  open,
  onToggle,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: Array<{ label: string; value: number }>;
  open: boolean;
  onToggle: () => void;
  onChange: (value: number) => void;
}) {
  const selected = options.find(option => option.value === value);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, value]);

  return (
    <div className="date-choice">
      <button
        type="button"
        className={`date-choice-trigger${open ? ' open' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{selected?.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="date-choice-menu">
          <CustomScrollArea
            id={id}
            label={label}
            className="date-choice-scroll"
            viewportClassName="date-choice-viewport"
            role="listbox"
          >
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'selected' : ''}
                ref={option.value === value ? selectedRef : undefined}
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </CustomScrollArea>
        </div>
      )}
    </div>
  );
}

function startOfMonth(value: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
}
