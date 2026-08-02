'use client';

import type { Employee } from '@pssms/api-client';

const AVATAR_PALETTE = [
  '#0078d4',
  '#0d9488',
  '#7c3aed',
  '#c026d3',
  '#ea580c',
  '#059669',
  '#0284c7',
  '#b45309',
] as const;

export function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

export function formatEmploymentType(type: string): string {
  const t = type.trim().toUpperCase();
  if (t === 'GUARD') return 'Guard';
  if (t === 'SUPERVISOR') return 'Supervisor';
  if (t === 'ADMIN') return 'Admin';
  if (t === 'OTHER') return 'Other';
  return type.replace(/_/g, ' ');
}

export function employmentTypeTone(type: string): {
  label: string;
  className: string;
} {
  const t = type.trim().toUpperCase();
  const label = formatEmploymentType(type);
  if (t === 'GUARD')
    return {
      label,
      className:
        'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    };
  if (t === 'SUPERVISOR')
    return {
      label,
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    };
  if (t === 'ADMIN')
    return {
      label,
      className: 'bg-violet-50 text-violet-800 ring-violet-200/80',
    };
  return {
    label,
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
  };
}

export function employeeStatusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'ACTIVE')
    return {
      label: 'Active',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s.includes('LEAVE'))
    return {
      label: 'On leave',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'SUSPENDED')
    return {
      label: 'Suspended',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  if (s === 'TERMINATED')
    return {
      label: 'Terminated',
      className: 'bg-slate-100 text-slate-600 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

export function matchesEmployeeSearch(e: Employee, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    e.fullName,
    e.employeeNumber,
    e.email,
    e.phone,
    e.department,
    e.employmentType,
    e.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function matchesEmployeeStatus(
  e: Employee,
  filter: 'all' | 'active' | 'leave' | 'suspended' | 'terminated',
): boolean {
  if (filter === 'all') return true;
  const s = e.status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (filter === 'active') return s === 'ACTIVE';
  if (filter === 'leave') return s.includes('LEAVE');
  if (filter === 'suspended') return s === 'SUSPENDED';
  if (filter === 'terminated') return s === 'TERMINATED';
  return true;
}
