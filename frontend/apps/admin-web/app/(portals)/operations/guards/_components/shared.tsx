'use client';

import type { Guard } from '@pssms/api-client';
import type { ReactNode } from 'react';

/** Ops readiness wall — navy / sky / emerald / amber / rose (no purple). */
export const WALL = {
  bg: '#0a1628',
  bgSoft: '#0f2137',
  panel: '#12263f',
  border: 'rgba(148, 163, 184, 0.18)',
  borderStrong: 'rgba(148, 163, 184, 0.32)',
  text: '#e8eef6',
  muted: '#94a3b8',
  amber: '#f59e0b',
  online: '#34d399',
  offline: '#f87171',
  accent: '#0078d4',
} as const;

export type RosterFilter = 'all' | 'active' | 'deployable' | 'suspended';
export type RosterView = 'cards' | 'list';

export const FILTER_CHIPS: { id: RosterFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'deployable', label: 'Deployable' },
  { id: 'suspended', label: 'Suspended' },
];

export const KPI_TONES = {
  sky: {
    card: 'from-sky-500/25 to-sky-950/40 ring-sky-400/35',
    icon: 'bg-sky-400/25 text-sky-200',
    value: 'text-sky-50',
    bar: 'bg-sky-400',
  },
  emerald: {
    card: 'from-emerald-500/25 to-emerald-950/40 ring-emerald-400/35',
    icon: 'bg-emerald-400/25 text-emerald-200',
    value: 'text-emerald-50',
    bar: 'bg-emerald-400',
  },
  teal: {
    card: 'from-teal-500/25 to-teal-950/40 ring-teal-400/35',
    icon: 'bg-teal-400/25 text-teal-200',
    value: 'text-teal-50',
    bar: 'bg-teal-400',
  },
  rose: {
    card: 'from-rose-500/30 to-rose-950/40 ring-rose-400/35',
    icon: 'bg-rose-400/25 text-rose-200',
    value: 'text-rose-50',
    bar: 'bg-rose-400',
  },
  amber: {
    card: 'from-amber-500/30 to-amber-950/40 ring-amber-400/40',
    icon: 'bg-amber-400/25 text-amber-200',
    value: 'text-amber-50',
    bar: 'bg-amber-400',
  },
  slate: {
    card: 'from-slate-500/20 to-slate-950/40 ring-slate-400/25',
    icon: 'bg-slate-400/20 text-slate-200',
    value: 'text-slate-50',
    bar: 'bg-slate-400',
  },
} as const;

export type KpiTone = keyof typeof KPI_TONES;

export function guardDisplayName(g: Guard): string {
  const name = g.fullName?.trim();
  return name || g.employeeNumber;
}

export function guardInitials(g: Guard): string {
  const name = g.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const num = g.employeeNumber.replace(/[^A-Za-z0-9]/g, '');
  return (num.slice(-2) || 'GD').toUpperCase();
}

export function matchesFilter(g: Guard, filter: RosterFilter): boolean {
  switch (filter) {
    case 'active':
      return g.status === 'ACTIVE';
    case 'deployable':
      return g.deploymentEligible;
    case 'suspended':
      return g.status === 'SUSPENDED';
    default:
      return true;
  }
}

export function matchesSearch(g: Guard, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    g.employeeNumber,
    g.fullName,
    g.phone,
    g.userId,
    g.employeeId,
    g.status,
    g.activeDeployment?.siteCode,
    g.activeDeployment?.siteName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function statusTone(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        className: 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/30',
      };
    case 'SUSPENDED':
      return {
        label: 'Suspended',
        className: 'bg-rose-400/20 text-rose-200 ring-rose-400/30',
      };
    case 'TERMINATED':
      return {
        label: 'Terminated',
        className: 'bg-slate-400/20 text-slate-300 ring-slate-400/25',
      };
    default:
      return {
        label: status,
        className: 'bg-amber-400/20 text-amber-200 ring-amber-400/30',
      };
  }
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: KpiTone;
  icon: ReactNode;
}) {
  const t = KPI_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${t.card} px-4 py-3.5 ring-1 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1 ${t.bar}`}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 pl-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-1.5 pl-1 text-2xl font-bold tracking-tight ${t.value}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate pl-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
