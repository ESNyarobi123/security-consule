'use client';

import {
  getKpiDrilldown,
  type KpiDrilldown,
  type KpiItem,
} from '@pssms/api-client';
import { AZURE } from '@pssms/ui';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  MapPin,
  Percent,
  Radio,
  RefreshCw,
  Shield,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export type CategoryTone = {
  label: string;
  accent: string;
  bar: string;
  soft: string;
  Icon: LucideIcon;
};

export const CATEGORY_META: Record<string, CategoryTone> = {
  OPS: {
    label: 'Operations',
    accent: 'text-sky-700',
    bar: 'bg-sky-500',
    soft: 'bg-sky-50 ring-sky-100',
    Icon: Shield,
  },
  SAFETY: {
    label: 'Safety & incidents',
    accent: 'text-rose-700',
    bar: 'bg-rose-500',
    soft: 'bg-rose-50 ring-rose-100',
    Icon: AlertTriangle,
  },
  ACCESS: {
    label: 'Access & parking',
    accent: 'text-teal-700',
    bar: 'bg-teal-500',
    soft: 'bg-teal-50 ring-teal-100',
    Icon: Building2,
  },
  COMMERCIAL: {
    label: 'Commercial',
    accent: 'text-emerald-700',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50 ring-emerald-100',
    Icon: Briefcase,
  },
  FINANCE: {
    label: 'Finance',
    accent: 'text-amber-800',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50 ring-amber-100',
    Icon: Wallet,
  },
  PAYROLL: {
    label: 'Payroll',
    accent: 'text-slate-700',
    bar: 'bg-slate-500',
    soft: 'bg-slate-50 ring-slate-200',
    Icon: CreditCard,
  },
  HR: {
    label: 'People',
    accent: 'text-[#005a9e]',
    bar: 'bg-[#0078d4]',
    soft: 'bg-[#eff6fc] ring-sky-100',
    Icon: Users,
  },
};

/** Codes shown as large spotlight tiles in the hero strip (order matters). */
export const SPOTLIGHT_CODES = [
  'GUARD_HEADCOUNT_ACTIVE',
  'GUARD_ON_DUTY',
  'OPEN_INCIDENTS',
  'CONTRACTS_ACTIVE',
  'CONTRACTS_MRR',
  'INVOICE_OUTSTANDING',
] as const;

export function formatKpiValue(kpi: KpiItem): string {
  if (kpi.unit === 'TZS') {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(kpi.value);
  }
  if (kpi.unit === 'PERCENT') {
    return `${Number(kpi.value).toLocaleString('en-TZ', {
      maximumFractionDigits: 1,
    })}%`;
  }
  return new Intl.NumberFormat('en-TZ').format(kpi.value);
}

export function findKpi(kpis: KpiItem[], code: string): KpiItem | undefined {
  return kpis.find((k) => k.code === code);
}

export function roleViewLabel(roles: string[]): string {
  if (roles.includes('SUPER_ADMIN')) return 'System Administrator view';
  if (roles.includes('CMD')) return 'CMD executive view';
  if (roles.includes('CEO')) return 'CEO executive view';
  if (roles.includes('GENERAL_MANAGER')) return 'GM executive view';
  if (roles.length) return `${roles[0]} view`;
  return 'Executive view';
}

export function ExecChrome({
  userName,
  roleLabel,
  health,
  refreshing,
  onRefresh,
  onExport,
  onLogout,
  period,
  children,
}: {
  userName: string;
  roleLabel?: string;
  health: string;
  refreshing: boolean;
  onRefresh: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onLogout: () => void;
  period: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen text-[#323130]"
      style={{ background: AZURE.neutralBg }}
    >
      <header
        className="border-b border-white/10 text-white shadow-md"
        style={{
          background: `linear-gradient(125deg, #071525 0%, ${AZURE.navy} 42%, #0b4f7a 78%, #0e7490 100%)`,
        }}
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg ring-2 ring-white/15"
              style={{
                background:
                  'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
              }}
            >
              HL
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200 ring-1 ring-sky-300/30">
                  Portal 35.2
                </span>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                  Executive · CMD / CEO / GM
                </span>
              </div>
              <h1 className="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
                <LayoutDashboard className="h-5 w-5 text-sky-300" />
                Executive Dashboard
              </h1>
              <p className="truncate text-sm text-slate-300">
                {userName
                  ? `${roleLabel ?? 'Executive view'} · ${userName}`
                  : 'Company-wide KPIs · live + snapshots'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] text-slate-200">
              {health}
            </span>
            {(
              [
                ['csv', FileText, 'CSV'],
                ['xlsx', FileSpreadsheet, 'Excel'],
                ['pdf', FileText, 'PDF'],
              ] as const
            ).map(([fmt, Icon, label]) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onExport(fmt)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/15"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-1.5 text-xs font-bold text-[#072033] shadow-md transition hover:bg-sky-300 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              {refreshing ? 'Refreshing…' : 'Refresh KPIs'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {period}
        {children}
      </main>
    </div>
  );
}

export function SpotlightTile({
  kpi,
  accent,
  Icon,
}: {
  kpi: KpiItem;
  accent: 'sky' | 'emerald' | 'rose' | 'amber' | 'teal' | 'blue';
  Icon: LucideIcon;
}) {
  const tones: Record<string, string> = {
    sky: 'from-sky-500/20 to-sky-950/30 ring-sky-400/30',
    emerald: 'from-emerald-500/20 to-emerald-950/30 ring-emerald-400/30',
    rose: 'from-rose-500/25 to-rose-950/30 ring-rose-400/30',
    amber: 'from-amber-500/25 to-amber-950/30 ring-amber-400/35',
    teal: 'from-teal-500/20 to-teal-950/30 ring-teal-400/30',
    blue: 'from-[#0078d4]/25 to-[#0b1f3a]/40 ring-sky-400/30',
  };
  const iconBg: Record<string, string> = {
    sky: 'bg-sky-400/25 text-sky-100',
    emerald: 'bg-emerald-400/25 text-emerald-100',
    rose: 'bg-rose-400/25 text-rose-100',
    amber: 'bg-amber-400/25 text-amber-100',
    teal: 'bg-teal-400/25 text-teal-100',
    blue: 'bg-[#0078d4]/35 text-sky-100',
  };

  return (
    <article
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ${tones[accent]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg[accent]}`}
        >
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            kpi.source === 'snapshot'
              ? 'bg-emerald-400/20 text-emerald-200'
              : 'bg-sky-400/20 text-sky-200'
          }`}
        >
          {kpi.source}
        </span>
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-300">
        {kpi.name}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums">
        {formatKpiValue(kpi)}
      </p>
    </article>
  );
}

/** Metric blurbs + admin deep-links (executive read → ops action). */
const METRIC_META: Record<
  string,
  { hint: string; Icon: LucideIcon; adminHref?: string; adminLabel?: string }
> = {
  GUARD_HEADCOUNT_ACTIVE: {
    hint: 'Guards with ACTIVE status (deployable pool).',
    Icon: Shield,
    adminHref: 'http://localhost:3000/operations/guards',
    adminLabel: 'Open Guards console',
  },
  GUARD_ON_DUTY: {
    hint: 'Guards currently clocked in (open attendance).',
    Icon: Radio,
    adminHref: 'http://localhost:3000/branch/attendance',
    adminLabel: 'Attendance board',
  },
  ATTENDANCE_CLOCK_INS: {
    hint: 'Clock-in events in the selected period.',
    Icon: Timer,
    adminHref: 'http://localhost:3000/branch/attendance',
    adminLabel: 'Attendance board',
  },
  ATTENDANCE_APPROVAL_RATE: {
    hint: 'Share of attendance records supervisor-approved.',
    Icon: CheckCircle2,
    adminHref: 'http://localhost:3000/branch/attendance',
    adminLabel: 'Approve pending',
  },
  ALERTNESS_CONFIRM_RATE: {
    hint: 'Scheduled alertness checks confirmed on time.',
    Icon: Percent,
    adminHref: 'http://localhost:3000/branch/attendance',
    adminLabel: 'Alertness queue',
  },
  FIELD_ALERTS_OPEN: {
    hint: 'Unacknowledged field alerts (missed alertness / patrol).',
    Icon: Bell,
    adminHref: 'http://localhost:3000/branch/alerts',
    adminLabel: 'Field alerts',
  },
  DEPLOYMENTS_ACTIVE: {
    hint: 'Active guard postings linked to billable contracts.',
    Icon: MapPin,
    adminHref: 'http://localhost:3000/branch/deployments',
    adminLabel: 'Deployments',
  },
};

const CATEGORY_ACTIONS: Record<
  string,
  { label: string; href: string; hint: string }[]
> = {
  OPS: [
    {
      label: 'Branch Ops',
      href: 'http://localhost:3000/branch',
      hint: 'Sites · attendance · patrols',
    },
    {
      label: 'Patrols & SLA',
      href: 'http://localhost:3000/branch/patrols',
      hint: 'Late / missed routes',
    },
    {
      label: 'Field alerts',
      href: 'http://localhost:3000/branch/alerts',
      hint: 'Escalate · acknowledge',
    },
    {
      label: 'Guards readiness',
      href: 'http://localhost:3000/operations/guards',
      hint: 'Deployable · checklist',
    },
  ],
  SAFETY: [
    {
      label: 'Incidents',
      href: 'http://localhost:3000/branch/incidents',
      hint: 'Escalate matrix',
    },
  ],
  ACCESS: [
    {
      label: 'Parking portal',
      href: 'http://localhost:3006',
      hint: 'Entries · violations',
    },
  ],
  COMMERCIAL: [
    {
      label: 'Contracts',
      href: 'http://localhost:3000/superadmin/contracts',
      hint: 'Active · MRR',
    },
  ],
  FINANCE: [
    {
      label: 'Invoices',
      href: 'http://localhost:3000/finance',
      hint: 'Outstanding · collect',
    },
  ],
  PAYROLL: [
    {
      label: 'Payroll',
      href: 'http://localhost:3000/payroll',
      hint: 'Cycles · snapshots',
    },
  ],
  HR: [
    {
      label: 'HR employees',
      href: 'http://localhost:3000/hr/employees',
      hint: 'Active headcount',
    },
  ],
};

function buildInsights(category: string, items: KpiItem[]): string[] {
  const get = (code: string) => items.find((i) => i.code === code)?.value;
  const notes: string[] = [];

  if (category === 'OPS') {
    const active = get('GUARD_HEADCOUNT_ACTIVE') ?? 0;
    const onDuty = get('GUARD_ON_DUTY') ?? 0;
    const approval = get('ATTENDANCE_APPROVAL_RATE');
    const alertness = get('ALERTNESS_CONFIRM_RATE');
    const alerts = get('FIELD_ALERTS_OPEN') ?? 0;
    const deps = get('DEPLOYMENTS_ACTIVE') ?? 0;

    if (active > 0) {
      const coverage = Math.round((onDuty / active) * 100);
      notes.push(
        `Duty coverage ${coverage}% — ${onDuty} of ${active} active guards on duty now.`,
      );
    }
    if (typeof approval === 'number') {
      notes.push(
        approval >= 80
          ? `Attendance approval healthy at ${approval}%.`
          : `Attendance approval ${approval}% — supervisors should clear pending punches.`,
      );
    }
    if (typeof alertness === 'number') {
      notes.push(`Alertness confirm rate ${alertness}% for the period.`);
    }
    if (alerts > 0) {
      notes.push(
        `${alerts} open field alert${alerts === 1 ? '' : 's'} need escalate/ack.`,
      );
    } else {
      notes.push('No open field alerts — ops queue clear.');
    }
    notes.push(`${deps} active deployment${deps === 1 ? '' : 's'} on contract sites.`);
  } else {
    const live = items.filter((i) => i.source === 'live').length;
    const snap = items.filter((i) => i.source === 'snapshot').length;
    notes.push(
      `${items.length} metrics in view (${live} live · ${snap} snapshot).`,
    );
    const top = [...items].sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value),
    )[0];
    if (top) {
      notes.push(`Largest signal: ${top.name} = ${formatKpiValue(top)}.`);
    }
  }

  return notes;
}

export function CategoryPanel({
  category,
  items,
  token,
  from,
  to,
}: {
  category: string;
  items: KpiItem[];
  token: string | null;
  from: string;
  to: string;
}) {
  const meta = CATEGORY_META[category] ?? {
    label: category,
    accent: 'text-slate-700',
    bar: 'bg-slate-400',
    soft: 'bg-slate-50 ring-slate-200',
    Icon: LayoutDashboard,
  };
  const Icon = meta.Icon;
  const [selectedCode, setSelectedCode] = useState(items[0]?.code ?? '');
  const [drill, setDrill] = useState<KpiDrilldown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const selected =
    items.find((i) => i.code === selectedCode) ?? items[0] ?? null;
  const max = Math.max(...items.map((i) => Math.abs(i.value) || 0), 1);
  const insights = useMemo(
    () => buildInsights(category, items),
    [category, items],
  );
  const actions = CATEGORY_ACTIONS[category] ?? [];
  const selectedMeta = selected ? METRIC_META[selected.code] : undefined;
  const SelectedIcon = selectedMeta?.Icon ?? Icon;

  useEffect(() => {
    if (!items.some((i) => i.code === selectedCode) && items[0]) {
      setSelectedCode(items[0].code);
    }
  }, [items, selectedCode]);

  useEffect(() => {
    if (!token || !selectedCode) {
      setDrill(null);
      return;
    }
    let cancelled = false;
    setDrillLoading(true);
    setDrillError(null);
    void getKpiDrilldown(token, selectedCode, { from, to })
      .then((d) => {
        if (!cancelled) setDrill(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setDrill(null);
          setDrillError(
            err instanceof Error ? err.message : 'Drill-down failed',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDrillLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedCode, from, to]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#edebe9] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${meta.soft} ${meta.accent}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className={`text-sm font-semibold ${meta.accent}`}>
              {meta.label}
            </h2>
            <p className="text-[11px] text-[#605e5c]">
              {items.length} metrics · select left → analysis right
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* LEFT — feature / metric list */}
        <div className="border-b border-[#edebe9] lg:border-b-0 lg:border-r">
          <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d] sm:px-5">
            Metrics
          </p>
          <ul className="max-h-[420px] space-y-0.5 overflow-y-auto p-2 sm:p-3">
            {items.map((kpi) => {
              const active = selected?.code === kpi.code;
              const m = METRIC_META[kpi.code];
              const RowIcon = m?.Icon ?? Icon;
              const pct = Math.min(100, (Math.abs(kpi.value) / max) * 100);
              return (
                <li key={kpi.code}>
                  <button
                    type="button"
                    onClick={() => setSelectedCode(kpi.code)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? 'bg-[#eff6fc] ring-1 ring-[#0078d4]/35'
                        : 'hover:bg-[#faf9f8]'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-[#0078d4] text-white'
                          : `${meta.soft} ${meta.accent}`
                      }`}
                    >
                      <RowIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[#323130]">
                          {kpi.name}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1b1a19]">
                          {formatKpiValue(kpi)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[#e1dfdd]">
                        <span
                          className={`block h-full rounded-full ${meta.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-[#0078d4]' : 'text-[#c8c6c4]'
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT — analysis + options */}
        <div className="flex flex-col gap-4 bg-[#faf9f8] p-4 sm:p-5">
          {selected ? (
            <>
              <div className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${meta.soft} ${meta.accent}`}
                    >
                      <SelectedIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d]">
                        Selected metric
                      </p>
                      <h3 className="text-base font-semibold text-[#1b1a19]">
                        {selected.name}
                      </h3>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-[#605e5c]">
                        {selectedMeta?.hint ??
                          `${category} KPI from reporting service.`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-[#1b1a19]">
                      {formatKpiValue(selected)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        selected.source === 'snapshot'
                          ? 'bg-[#dff6dd] text-[#0e700e]'
                          : 'bg-[#eff6fc] text-[#005a9e]'
                      }`}
                    >
                      {selected.source}
                    </span>
                  </div>
                </div>
                <p className="mt-3 font-mono text-[10px] text-[#a19f9d]">
                  {selected.code}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d]">
                  Analysis
                </p>
                <ul className="mt-2 space-y-2">
                  {insights.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-xs leading-relaxed text-[#323130]"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.bar}`}
                      />
                      {line}
                    </li>
                  ))}
                </ul>

                {/* Live drill-down by site */}
                <div className="mt-4 space-y-2 border-t border-[#edebe9] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d]">
                    Drill-down by site
                  </p>
                  {drillLoading ? (
                    <p className="text-xs text-[#605e5c]">Loading sites…</p>
                  ) : null}
                  {drillError ? (
                    <p className="text-xs text-rose-700">{drillError}</p>
                  ) : null}
                  {drill?.breakdown ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {Object.entries(drill.breakdown).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded-md bg-[#f3f2f1] px-2 py-1 font-mono text-[10px] text-[#323130]"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {drill && drill.bySite.length > 0 ? (
                    <ul className="space-y-2">
                      {(() => {
                        const siteMax = Math.max(
                          ...drill.bySite.map((s) => s.value),
                          1,
                        );
                        return drill.bySite.map((s) => (
                          <li key={s.siteId}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate font-medium text-[#323130]">
                                {s.siteCode}{' '}
                                <span className="font-normal text-[#605e5c]">
                                  {s.siteName}
                                </span>
                              </span>
                              <span className="tabular-nums font-semibold text-[#1b1a19]">
                                {s.value.toLocaleString('en-TZ')}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e1dfdd]">
                              <div
                                className={`h-full rounded-full ${meta.bar}`}
                                style={{
                                  width: `${Math.min(100, (s.value / siteMax) * 100)}%`,
                                }}
                              />
                            </div>
                          </li>
                        ));
                      })()}
                    </ul>
                  ) : !drillLoading && !drillError ? (
                    <p className="text-xs text-[#605e5c]">
                      {drill?.notes?.[0] ??
                        'No site rows for this metric in the period.'}
                    </p>
                  ) : null}
                </div>

                {/* Relative bar chart of all metrics in category */}
                <div className="mt-4 space-y-2 border-t border-[#edebe9] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d]">
                    Category comparison
                  </p>
                  {items.map((kpi) => {
                    const pct = Math.min(
                      100,
                      (Math.abs(kpi.value) / max) * 100,
                    );
                    const hi = kpi.code === selected.code;
                    return (
                      <button
                        key={kpi.code}
                        type="button"
                        onClick={() => setSelectedCode(kpi.code)}
                        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-left"
                      >
                        <span
                          className={`truncate text-[11px] ${
                            hi
                              ? 'font-semibold text-[#0078d4]'
                              : 'text-[#605e5c]'
                          }`}
                        >
                          {kpi.name}
                        </span>
                        <span className="text-[11px] font-medium tabular-nums text-[#323130]">
                          {formatKpiValue(kpi)}
                        </span>
                        <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[#e1dfdd]">
                          <span
                            className={`block h-full rounded-full ${
                              hi ? 'bg-[#0078d4]' : meta.bar
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a19f9d]">
                  Options · open in Admin
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {selectedMeta?.adminHref ? (
                    <a
                      href={selectedMeta.adminHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#0078d4]/25 bg-[#eff6fc] px-3 py-2.5 text-xs font-semibold text-[#005a9e] transition hover:border-[#0078d4]"
                    >
                      {selectedMeta.adminLabel ?? 'Open related'}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : null}
                  {actions.map((a) => (
                    <a
                      key={a.href}
                      href={a.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2.5 transition hover:border-[#0078d4]/40 hover:bg-white"
                    >
                      <span>
                        <span className="block text-xs font-semibold text-[#323130]">
                          {a.label}
                        </span>
                        <span className="text-[10px] text-[#605e5c]">
                          {a.hint}
                        </span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#0078d4]" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#605e5c]">No metrics in this category.</p>
          )}
        </div>
      </div>
    </section>
  );
}
