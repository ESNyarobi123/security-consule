'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { avatarColor, employeeInitials } from './employee-ui';

export function HrSectionHeader({
  title,
  count,
  subtitle,
  href,
  actionLabel = 'Open',
}: {
  title: string;
  count?: number;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#1b1a19]">{title}</h2>
          {count != null ? (
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {count}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-[#605e5c]">{subtitle}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#0078d4] transition hover:bg-[#eff6fc]"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function StatusPill({
  label,
  className,
  dot,
}: {
  label: string;
  className: string;
  dot?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
    </span>
  );
}

export function TypeChip({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${className}`}
    >
      {label}
    </span>
  );
}

export function PersonCell({
  name,
  subtitle,
  seed,
}: {
  name: string;
  subtitle?: string;
  seed: string;
}) {
  const bg = avatarColor(seed);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide text-white shadow-sm ring-2 ring-white"
        style={{
          background: `linear-gradient(145deg, ${bg} 0%, color-mix(in srgb, ${bg} 70%, #0f172a) 100%)`,
        }}
        aria-hidden
      >
        {employeeInitials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
          {name}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] text-[#8a8886]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HrListShell({
  toolbar,
  headers,
  headerClassName,
  loading,
  empty,
  isEmpty,
  children,
  skeletonRows = 4,
}: {
  toolbar?: ReactNode;
  headers: string[];
  headerClassName: string;
  loading?: boolean;
  empty?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
  skeletonRows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      <div
        className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${headerClassName}`}
      >
        {headers.map((h, i) => (
          <span key={`${i}-${h || 'col'}`}>{h}</span>
        ))}
      </div>

      {loading ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <li key={`sk-${i}`} className="animate-pulse px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#edebe9]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-[#edebe9]" />
                  <div className="h-2.5 w-24 rounded bg-[#f3f2f1]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : isEmpty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <ul className="divide-y divide-[#f3f2f1]">{children}</ul>
      )}
    </div>
  );
}

export function workflowStatusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'PENDING' || s === 'PLANNED' || s === 'OPEN')
    return {
      label: s === 'PLANNED' ? 'Planned' : s === 'OPEN' ? 'Open' : 'Pending',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'ACTIVE' || s === 'CLOSED')
    return {
      label:
        s === 'APPROVED'
          ? 'Approved'
          : s === 'COMPLETED'
            ? 'Completed'
            : s === 'CLOSED'
              ? 'Closed'
              : 'Active',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'REJECTED' || s === 'CANCELLED' || s === 'INACTIVE')
    return {
      label:
        s === 'REJECTED'
          ? 'Rejected'
          : s === 'CANCELLED'
            ? 'Cancelled'
            : 'Inactive',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

export function severityTone(severity: string): {
  label: string;
  className: string;
} {
  const s = severity.trim().toUpperCase();
  if (s === 'CRITICAL')
    return {
      label: 'Critical',
      className: 'bg-rose-100 text-rose-900 ring-rose-300/80',
    };
  if (s === 'HIGH')
    return {
      label: 'High',
      className: 'bg-orange-50 text-orange-900 ring-orange-200/80',
    };
  if (s === 'MEDIUM')
    return {
      label: 'Medium',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
    };
  return {
    label: s === 'LOW' ? 'Low' : severity,
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
  };
}

export function movementTypeTone(type: string): {
  label: string;
  className: string;
} {
  const t = type.trim().toUpperCase();
  if (t === 'EXIT')
    return {
      label: 'Exit',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
    };
  if (t === 'TRANSFER')
    return {
      label: 'Transfer',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    };
  return {
    label: type.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
  };
}
