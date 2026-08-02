'use client';

import { forwardRef, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

export type TicketData = {
  reference: string;
  visitorName: string;
  hostName?: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

function formatShort(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Decorative barcode stripes derived from reference (visual only). */
function Barcode({ value }: { value: string }) {
  const bars = useMemo(() => {
    const seed = value || 'HL';
    const out: number[] = [];
    for (let i = 0; i < 48; i++) {
      const c = seed.charCodeAt(i % seed.length);
      out.push(1 + ((c + i * 7) % 3));
    }
    return out;
  }, [value]);

  return (
    <div className="flex h-10 items-end gap-px" aria-hidden>
      {bars.map((w, i) => (
        <span
          key={i}
          className="bg-slate-900"
          style={{ width: w, height: i % 5 === 0 ? '100%' : `${70 + (i % 4) * 8}%` }}
        />
      ))}
    </div>
  );
}

function PlaneIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
    </svg>
  );
}

type Props = {
  data: TicketData;
  /** landscape = boarding-pass; portrait = mobile stack */
  variant?: 'landscape' | 'portrait';
  className?: string;
};

export const AppointmentTicket = forwardRef<HTMLDivElement, Props>(
  function AppointmentTicket({ data, variant = 'landscape', className = '' }, ref) {
    const [qrUrl, setQrUrl] = useState<string>('');
    const payload = useMemo(
      () => `HIGHLINK-VISITOR-REF:${data.reference}`,
      [data.reference],
    );

    useEffect(() => {
      let cancelled = false;
      void QRCode.toDataURL(payload, {
        width: 160,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then((url) => {
        if (!cancelled) setQrUrl(url);
      });
      return () => {
        cancelled = true;
      };
    }, [payload]);

    const fromDate = formatShort(data.validFrom);
    const untilDate = formatShort(data.validUntil);
    const fromTime = formatTime(data.validFrom);
    const untilTime = formatTime(data.validUntil);

    if (variant === 'portrait') {
      return (
        <div
          ref={ref}
          className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
          data-ticket
        >
          <div className="flex items-center justify-between bg-[#2563eb] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">
                HL
              </span>
              <div>
                <p className="text-sm font-bold tracking-wide">HIGHLINK</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-blue-100">
                  Visitor pass
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
              Pending
            </span>
          </div>

          <div className="relative px-4 py-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Valid from
                </p>
                <p className="font-display text-2xl font-bold text-[#2563eb]">{fromDate}</p>
                <p className="text-sm font-semibold text-slate-700">{fromTime}</p>
              </div>
              <PlaneIcon className="mb-2 h-5 w-5 text-[#2563eb]" />
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Valid until
                </p>
                <p className="font-display text-2xl font-bold text-[#2563eb]">{untilDate}</p>
                <p className="text-sm font-semibold text-slate-700">{untilTime}</p>
              </div>
            </div>

            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Reference
                </p>
                <p className="font-mono text-lg font-bold tracking-wide text-[#2563eb]">
                  {data.reference}
                </p>
              </div>
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="" width={72} height={72} className="rounded-md" />
              ) : (
                <div className="h-[72px] w-[72px] rounded-md bg-slate-100" />
              )}
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div className="flex w-8 justify-center overflow-hidden">
                <div className="origin-center rotate-90 scale-90">
                  <Barcode value={data.reference} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Visitor name
                </p>
                <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                  {data.visitorName || '—'}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Host</p>
                    <p className="font-semibold text-slate-800">{data.hostName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Status</p>
                    <p className="font-semibold text-amber-700">Awaiting host</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
              Gate code is issued after host approval — not printed on this card.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`flex min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
        data-ticket
        style={{ width: '100%', maxWidth: 920 }}
      >
        {/* Brand strip */}
        <aside className="relative flex w-[72px] shrink-0 flex-col items-center justify-between bg-[#2563eb] px-2 py-5 text-white sm:w-[88px]">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">
              HL
            </span>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              HIGHLINK
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p
              className="text-[9px] font-semibold uppercase tracking-wider text-blue-100"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Visitor pass
            </p>
            <span className="rounded bg-white/15 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider">
              Pending
            </span>
          </div>
        </aside>

        {/* Main body */}
        <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-end gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Valid from
                </p>
                <p className="font-display text-2xl font-bold tracking-tight text-[#2563eb] sm:text-3xl">
                  {fromDate}
                </p>
                <p className="text-sm font-semibold text-slate-700">{fromTime}</p>
              </div>
              <div className="mb-1 flex flex-col items-center text-[#2563eb]">
                <PlaneIcon className="h-5 w-5" />
                <span className="mt-1 h-px w-10 bg-[#2563eb]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Valid until
                </p>
                <p className="font-display text-2xl font-bold tracking-tight text-[#2563eb] sm:text-3xl">
                  {untilDate}
                </p>
                <p className="text-sm font-semibold text-slate-700">{untilTime}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Reference
              </p>
              <p className="font-mono text-xl font-bold tracking-wide text-[#2563eb] sm:text-2xl">
                {data.reference}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Visitor name
              </p>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                {data.visitorName || '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Host
              </p>
              <p className="text-sm font-bold text-slate-900">{data.hostName || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Visit window
              </p>
              <p className="text-sm font-bold text-slate-900">
                {fromTime} – {untilTime}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4 border-t border-dashed border-slate-200 pt-3">
            <div>
              <Barcode value={data.reference} />
              <p className="mt-1 font-mono text-[10px] tracking-widest text-slate-500">
                {data.reference}
              </p>
            </div>
            <p className="max-w-[200px] text-right text-[10px] leading-relaxed text-slate-400">
              Gate code after host approval — not on this card.
            </p>
          </div>
        </div>

        {/* Tear / details column */}
        <div className="relative flex w-[140px] shrink-0 flex-col border-l border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 sm:w-[168px] sm:px-4">
          <div className="absolute -left-1.5 top-8 h-3 w-3 rounded-full bg-white ring-1 ring-slate-200" />
          <div className="absolute -left-1.5 bottom-8 h-3 w-3 rounded-full bg-white ring-1 ring-slate-200" />

          <div className="mb-3 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-100">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Status
            </p>
            <p className="text-sm font-bold text-amber-700">Pending</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
              <div>
                <p className="font-semibold uppercase text-slate-400">From</p>
                <p className="font-bold text-slate-800">{fromTime}</p>
              </div>
              <div>
                <p className="font-semibold uppercase text-slate-400">Until</p>
                <p className="font-bold text-slate-800">{untilTime}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col items-center">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt={`QR for ${data.reference}`}
                width={112}
                height={112}
                className="rounded-md bg-white p-1"
              />
            ) : (
              <div className="h-[112px] w-[112px] rounded-md bg-white" />
            )}
            <p className="mt-1 text-center text-[9px] font-medium text-slate-400">
              Scan reference
            </p>
          </div>
        </div>
      </div>
    );
  },
);
