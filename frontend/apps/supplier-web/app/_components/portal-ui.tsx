'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function PortalHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#0e2f52] to-[#9a3412] px-6 py-7 text-white shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, #fff 0, transparent 40%), radial-gradient(circle at 90% 10%, #fdba74 0, transparent 35%)',
        }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/90">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PortalStat({
  label,
  value,
  hint,
  href,
  tone = 'amber',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: 'sky' | 'teal' | 'amber' | 'rose' | 'violet' | 'emerald';
}) {
  const tones = {
    sky: 'from-sky-500/15 to-sky-500/5 ring-sky-200',
    teal: 'from-teal-500/15 to-teal-500/5 ring-teal-200',
    amber: 'from-amber-500/15 to-amber-500/5 ring-amber-200',
    rose: 'from-rose-500/15 to-rose-500/5 ring-rose-200',
    violet: 'from-violet-500/15 to-violet-500/5 ring-violet-200',
    emerald: 'from-emerald-500/15 to-emerald-500/5 ring-emerald-200',
  } as const;

  const inner = (
    <div
      className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#1b1a19]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#605e5c]">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function PortalPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#1b1a19]">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PortalError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {message}
    </p>
  );
}

export function money(amount: string | number, currency = 'TZS') {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: currency || 'TZS',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || 'TZS'} ${n.toLocaleString()}`;
  }
}

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (withTime) {
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function StatusPill({ status }: { status: string }) {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  let className = 'bg-slate-100 text-slate-700 ring-slate-200';
  let dot = 'bg-slate-400';
  if (
    s.includes('ACTIVE') ||
    s.includes('APPROVED') ||
    s.includes('RECEIVED') ||
    s.includes('CLOSED') ||
    s.includes('COMPLETED')
  ) {
    className = 'bg-emerald-50 text-emerald-800 ring-emerald-200/80';
    dot = 'bg-emerald-500';
  } else if (
    s.includes('CANCEL') ||
    s.includes('REJECT') ||
    s.includes('VOID')
  ) {
    className = 'bg-rose-50 text-rose-800 ring-rose-200/80';
    dot = 'bg-rose-500';
  } else if (
    s.includes('PENDING') ||
    s.includes('DRAFT') ||
    s.includes('ISSUED') ||
    s.includes('SENT') ||
    s.includes('PARTIAL') ||
    s.includes('OPEN')
  ) {
    className = 'bg-amber-50 text-amber-900 ring-amber-200/80';
    dot = 'bg-amber-500';
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
