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

export function SectionLabel({
  title,
  href,
  count,
  actions,
}: {
  title: string;
  href: string;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {title}
        {count != null ? (
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({count})
          </span>
        ) : null}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Link
          href={href}
          className="text-[11px] font-medium text-[#0067b8] hover:text-[#004578]"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}

type QuickGlyph = 'users' | 'wallet' | 'coins' | 'shield' | 'building' | 'calendar';

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

export const EMPLOYMENT_TYPES = [
  'GUARD',
  'SUPERVISOR',
  'ADMIN',
  'OTHER',
] as const;

export const EMPLOYEE_STATUSES = [
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
] as const;
