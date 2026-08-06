'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function CareersShell({
  children,
  active = 'careers',
}: {
  children: ReactNode;
  active?: 'careers' | 'status' | 'partner';
}) {
  const link = (key: typeof active, href: string, label: string) => {
    const on = active === key;
    return (
      <Link
        href={href}
        className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
          on
            ? 'bg-white/15 text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f4f7fb] text-[#323130]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-[#0b1f3a] via-[#0e2f52] to-[#312e81] text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-[#4f46e5] text-[11px] font-bold shadow">
              HL
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              HIGHLINK{' '}
              <span className="hidden font-normal text-indigo-100/90 sm:inline">
                Careers
              </span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {link('careers', '/', 'Open roles')}
            {link('status', '/status', 'My application')}
            {link('partner', '/partner/login', 'Partner')}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-[#e1dfdd] bg-white/80 py-4 text-center text-[11px] text-[#605e5c]">
        HIGHLINK Investigation and Security Guard Company · Portal 35.13 / 35.14
      </footer>
    </div>
  );
}

export function CareersHero({
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
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#1e3a5f] to-[#4f46e5] px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 20%, #fff 0, transparent 40%), radial-gradient(circle at 88% 15%, #a5b4fc 0, transparent 38%)',
        }}
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100/90">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-200/90 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  let className = 'bg-slate-100 text-slate-700 ring-slate-200';
  let dot = 'bg-slate-400';
  if (s.includes('HIRED') || s.includes('OFFER') || s.includes('ACTIVE')) {
    className = 'bg-emerald-50 text-emerald-800 ring-emerald-200/80';
    dot = 'bg-emerald-500';
  } else if (s.includes('REJECT') || s.includes('CLOSED') || s.includes('CANCEL')) {
    className = 'bg-rose-50 text-rose-800 ring-rose-200/80';
    dot = 'bg-rose-500';
  } else if (
    s.includes('SUBMIT') ||
    s.includes('SCREEN') ||
    s.includes('INTERVIEW') ||
    s.includes('PENDING') ||
    s.includes('OPEN') ||
    s.includes('REVIEW')
  ) {
    className = 'bg-indigo-50 text-indigo-900 ring-indigo-200/80';
    dot = 'bg-indigo-500';
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

export function formatDate(iso?: string | null, withTime = false) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-[#323130]">
      {label}
      {hint ? (
        <span className="ml-1 font-normal text-[#a19f9d]">({hint})</span>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20';
