'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AzureGlyph } from '@pssms/ui';

export function PanelEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-4 py-8 text-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#605e5c] shadow-sm">
        {icon}
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}

type QuickGlyph =
  | 'users'
  | 'wallet'
  | 'coins'
  | 'shield'
  | 'building'
  | 'calendar'
  | 'box'
  | 'user-check'
  | 'clipboard'
  | 'megaphone'
  | 'book'
  | 'check-circle'
  | 'bell';

export function QuickLink({
  href,
  label,
  hint,
  glyph,
}: {
  href: string;
  label: string;
  hint: string;
  glyph: QuickGlyph;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2.5 shadow-sm transition hover:border-[#0078d4]/40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
        <AzureGlyph name={glyph} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#1b1a19]">{label}</p>
        <p className="truncate text-[11px] text-[#605e5c]">{hint}</p>
      </div>
    </Link>
  );
}

export function formatMoney(amount: number, currency = 'TZS') {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Detect ESS 404 when HR has not linked userId → employee. */
export function isEssProfileMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ESS_PROFILE_MISSING') ||
    msg.includes('Ask HR to link your account')
  );
}
