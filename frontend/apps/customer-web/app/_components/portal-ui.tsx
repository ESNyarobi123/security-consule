'use client';

import { LayoutGrid, List, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/* ─── Hero / stats / panels ─────────────────────────────────────────────── */

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
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1f3a] via-[#0e2f52] to-[#0d9488] px-6 py-7 text-white shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 20%, #fff 0, transparent 40%), radial-gradient(circle at 90% 10%, #5eead4 0, transparent 35%)',
        }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/90">
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
  tone = 'sky',
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

export function ComingSoonModule({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className="rounded-2xl border border-dashed border-teal-200 bg-gradient-to-br from-white to-teal-50/40 p-8 text-center shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
        Coming online
      </p>
      <h2 className="mt-2 text-xl font-bold text-[#1b1a19]">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[#605e5c]">{description}</p>
      {bullets?.length ? (
        <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-[#323130]">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-5 text-xs text-[#605e5c]">
        Data stays scoped to your organisation — Customer A never sees Customer B.
      </p>
    </div>
  );
}

/* ─── Formatters / status ───────────────────────────────────────────────── */

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

export function initials(name: string, fallback = '?') {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

const AVATAR = [
  '#0078d4',
  '#0d9488',
  '#7c3aed',
  '#ea580c',
  '#059669',
  '#0284c7',
  '#c026d3',
  '#b45309',
] as const;

export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

export type StatusTone = {
  label: string;
  className: string;
  dot: string;
};

export function statusTone(status: string): StatusTone {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (
    s.includes('ACTIVE') ||
    s.includes('PAID') ||
    s.includes('APPROVED') ||
    s.includes('CLOSED') ||
    s.includes('RESOLVED') ||
    s === 'PRESENT'
  ) {
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  }
  if (
    s.includes('OVERDUE') ||
    s.includes('CANCEL') ||
    s.includes('VOID') ||
    s.includes('CRITICAL') ||
    s.includes('HIGH') ||
    s.includes('DENIED') ||
    s.includes('REJECT')
  ) {
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  }
  if (
    s.includes('PENDING') ||
    s.includes('DRAFT') ||
    s.includes('EXPIR') ||
    s.includes('SENT') ||
    s.includes('PARTIAL') ||
    s.includes('OPEN') ||
    s.includes('INVESTIGAT') ||
    s.includes('MEDIUM') ||
    s.includes('SCHEDULED')
  ) {
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  }
  if (s.includes('LOW') || s.includes('INFO')) {
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  }
  return {
    label: status.replace(/_/g, ' ') || '—',
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

/* ─── Toolbar / empty / error / deferral ────────────────────────────────── */

export type PortalFilterChip = {
  id: string;
  label: string;
  count?: number;
};

export function PortalToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  view,
  onViewChange,
  trailing,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: PortalFilterChip[];
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
  view?: 'cards' | 'list';
  onViewChange?: (view: 'cards' | 'list') => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#e1dfdd] bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
      {onSearchChange ? (
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8886]" />
          <input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-[#e1dfdd] bg-[#faf9f8] py-2 pl-9 pr-3 text-sm text-[#323130] outline-none ring-[#0078d4] placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:bg-white focus:ring-1"
          />
        </label>
      ) : null}

      {filters?.length && onFilterChange ? (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#0078d4] text-white shadow-sm'
                    : 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9]'
                }`}
              >
                {f.label}
                {typeof f.count === 'number' ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? 'bg-white/20' : 'bg-white text-[#605e5c]'
                    }`}
                  >
                    {f.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {trailing}
        {view && onViewChange ? (
          <div className="flex rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-0.5">
            <button
              type="button"
              aria-label="Card view"
              onClick={() => onViewChange('cards')}
              className={`rounded-md p-1.5 ${
                view === 'cards'
                  ? 'bg-white text-[#0078d4] shadow-sm'
                  : 'text-[#8a8886] hover:text-[#323130]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => onViewChange('list')}
              className={`rounded-md p-1.5 ${
                view === 'list'
                  ? 'bg-white text-[#0078d4] shadow-sm'
                  : 'text-[#8a8886] hover:text-[#323130]'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PortalEmpty({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e1dfdd] bg-white px-6 py-12 text-center shadow-sm">
      {icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-[#323130]">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-[#605e5c]">{description}</p>
      ) : null}
    </div>
  );
}

export function PortalError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {message}
    </div>
  );
}

export function PortalDeferral({ note }: { note: string }) {
  return (
    <p className="mt-6 border-t border-[#edebe9] pt-4 text-xs text-[#8a8886]">
      {note}
    </p>
  );
}

export function AvatarBadge({
  seed,
  label,
  size = 'md',
}: {
  seed: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bg = avatarColor(seed);
  const dim =
    size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-[12px]';
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm ring-2 ring-white ${dim}`}
      style={{
        background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
      }}
    >
      {label}
    </span>
  );
}
