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
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Percent,
  Radio,
  RefreshCw,
  Scale,
  Shield,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminWebUrl, parkingWebUrl } from '@/lib/portals';

export type CategoryTone = {
  label: string;
  accent: string;
  bar: string;
  soft: string;
  Icon: LucideIcon;
};

export const CATEGORY_META: Record<string, CategoryTone> = {
  ENTERPRISE: {
    label: 'Branches & sites',
    accent: 'text-indigo-700',
    bar: 'bg-indigo-500',
    soft: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    Icon: Building2,
  },
  OPS: {
    label: 'Operations',
    accent: 'text-sky-700',
    bar: 'bg-sky-500',
    soft: 'bg-sky-50 text-sky-700 ring-sky-100',
    Icon: Shield,
  },
  SAFETY: {
    label: 'Safety',
    accent: 'text-rose-700',
    bar: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-700 ring-rose-100',
    Icon: AlertTriangle,
  },
  ACCESS: {
    label: 'Access',
    accent: 'text-teal-700',
    bar: 'bg-teal-500',
    soft: 'bg-teal-50 text-teal-700 ring-teal-100',
    Icon: MapPin,
  },
  COMMERCIAL: {
    label: 'Commercial',
    accent: 'text-emerald-700',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    Icon: Briefcase,
  },
  FINANCE: {
    label: 'Finance',
    accent: 'text-amber-800',
    bar: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-800 ring-amber-100',
    Icon: Wallet,
  },
  PAYROLL: {
    label: 'Payroll',
    accent: 'text-slate-700',
    bar: 'bg-slate-500',
    soft: 'bg-slate-50 text-slate-700 ring-slate-200',
    Icon: CreditCard,
  },
  HR: {
    label: 'People',
    accent: 'text-[#005a9e]',
    bar: 'bg-[#0078d4]',
    soft: 'bg-[#eff6fc] text-[#005a9e] ring-sky-100',
    Icon: Users,
  },
  COMPLIANCE: {
    label: 'Compliance',
    accent: 'text-violet-700',
    bar: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-700 ring-violet-100',
    Icon: Scale,
  },
};

/** Codes shown as large spotlight tiles (order = §35.2 priority). */
export const SPOTLIGHT_CODES = [
  'BRANCHES_ACTIVE',
  'CUSTOMERS_ACTIVE',
  'CONTRACTS_ACTIVE',
  'REVENUE_COLLECTED',
  'DEPLOYMENTS_ACTIVE',
  'INVOICE_OUTSTANDING',
  'OPEN_INCIDENTS',
  'COMPLIANCE_BREACHES_OPEN',
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

/** Preline-style app shell — compact sticky header + soft page canvas. */
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
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
              style={{
                background: `linear-gradient(145deg, #34d399 0%, ${AZURE.blue} 55%, #0e7490 100%)`,
              }}
            >
              HL
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
                  Executive Dashboard
                </h1>
                <span className="hidden rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100 sm:inline">
                  Portal 35.2
                </span>
              </div>
              <p className="truncate text-base text-slate-500">
                {userName
                  ? `${roleLabel ?? 'Executive'} · ${userName}`
                  : 'Company-wide KPIs'}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="text-slate-400">{health}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {(
              [
                ['csv', FileText, 'CSV'],
                ['xlsx', FileSpreadsheet, 'Excel'],
                ['pdf', Download, 'PDF'],
              ] as const
            ).map(([fmt, Icon, label]) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onExport(fmt)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-1.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#106ebe] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              aria-label="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
        {period}
        {children}
      </main>
    </div>
  );
}

const KPI_CARD_TONE: Record<
  string,
  { iconWrap: string; Icon: LucideIcon }
> = {
  BRANCHES_ACTIVE: {
    iconWrap: 'bg-indigo-100 text-indigo-700',
    Icon: Building2,
  },
  CUSTOMERS_ACTIVE: {
    iconWrap: 'bg-emerald-100 text-emerald-700',
    Icon: Briefcase,
  },
  CONTRACTS_ACTIVE: {
    iconWrap: 'bg-emerald-100 text-emerald-700',
    Icon: FileText,
  },
  REVENUE_COLLECTED: {
    iconWrap: 'bg-blue-100 text-blue-700',
    Icon: Wallet,
  },
  DEPLOYMENTS_ACTIVE: {
    iconWrap: 'bg-sky-100 text-sky-700',
    Icon: MapPin,
  },
  GUARD_HEADCOUNT_ACTIVE: {
    iconWrap: 'bg-sky-100 text-sky-700',
    Icon: Shield,
  },
  GUARD_ON_DUTY: { iconWrap: 'bg-teal-100 text-teal-700', Icon: Users },
  OPEN_INCIDENTS: {
    iconWrap: 'bg-rose-100 text-rose-700',
    Icon: AlertTriangle,
  },
  CRITICAL_INCIDENTS_OPEN: {
    iconWrap: 'bg-rose-100 text-rose-800',
    Icon: AlertTriangle,
  },
  CONTRACTS_MRR: { iconWrap: 'bg-blue-100 text-blue-700', Icon: Wallet },
  INVOICE_OUTSTANDING: {
    iconWrap: 'bg-amber-100 text-amber-800',
    Icon: CreditCard,
  },
  COMPLIANCE_BREACHES_OPEN: {
    iconWrap: 'bg-violet-100 text-violet-700',
    Icon: Scale,
  },
  COMPLIANCE_POLICIES_PUBLISHED: {
    iconWrap: 'bg-violet-100 text-violet-700',
    Icon: FileCheck2,
  },
  RECRUITMENT_PIPELINE: {
    iconWrap: 'bg-sky-100 text-sky-700',
    Icon: Users,
  },
  PARKING_ENTRIES: {
    iconWrap: 'bg-teal-100 text-teal-700',
    Icon: MapPin,
  },
};

/** Preline-style light KPI / stats card. */
export function SpotlightTile({
  kpi,
  onClick,
}: {
  kpi: KpiItem;
  accent?: string;
  Icon?: LucideIcon;
  onClick?: () => void;
}) {
  const tone = KPI_CARD_TONE[kpi.code] ?? {
    iconWrap: 'bg-slate-100 text-slate-700',
    Icon: LayoutDashboard,
  };
  const Icon = tone.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone.iconWrap}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            kpi.source === 'snapshot'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
              : 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
          }`}
        >
          {kpi.source}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{kpi.name}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {formatKpiValue(kpi)}
      </p>
      <p className="mt-2 text-xs font-medium text-sky-600 opacity-0 transition group-hover:opacity-100">
        Open analysis →
      </p>
    </button>
  );
}

const METRIC_META: Record<
  string,
  { hint: string; Icon: LucideIcon; adminHref?: string; adminLabel?: string }
> = {
  GUARD_HEADCOUNT_ACTIVE: {
    hint: 'Guards with ACTIVE status (deployable pool).',
    Icon: Shield,
    adminHref: adminWebUrl('/operations/guards'),
    adminLabel: 'Open Guards console',
  },
  GUARD_ON_DUTY: {
    hint: 'Guards currently clocked in (open attendance).',
    Icon: Radio,
    adminHref: adminWebUrl('/branch/attendance'),
    adminLabel: 'Attendance board',
  },
  ATTENDANCE_CLOCK_INS: {
    hint: 'Clock-in events in the selected period.',
    Icon: Timer,
    adminHref: adminWebUrl('/branch/attendance'),
    adminLabel: 'Attendance board',
  },
  ATTENDANCE_APPROVAL_RATE: {
    hint: 'Share of attendance records supervisor-approved.',
    Icon: CheckCircle2,
    adminHref: adminWebUrl('/branch/attendance'),
    adminLabel: 'Approve pending',
  },
  ALERTNESS_CONFIRM_RATE: {
    hint: 'Scheduled alertness checks confirmed on time.',
    Icon: Percent,
    adminHref: adminWebUrl('/branch/attendance'),
    adminLabel: 'Alertness queue',
  },
  FIELD_ALERTS_OPEN: {
    hint: 'Unacknowledged field alerts (missed alertness / patrol).',
    Icon: Bell,
    adminHref: adminWebUrl('/branch/alerts'),
    adminLabel: 'Field alerts',
  },
  DEPLOYMENTS_ACTIVE: {
    hint: 'Active guard postings linked to billable contracts.',
    Icon: MapPin,
    adminHref: adminWebUrl('/branch/deployments'),
    adminLabel: 'Deployments',
  },
  BRANCHES_ACTIVE: {
    hint: 'Active regional / district branches (company footprint).',
    Icon: Building2,
    adminHref: adminWebUrl('/branch'),
    adminLabel: 'Branch Ops',
  },
  SITES_ACTIVE: {
    hint: 'Active customer / ops sites under branches.',
    Icon: MapPin,
    adminHref: adminWebUrl('/branch'),
    adminLabel: 'Sites',
  },
  CUSTOMERS_ACTIVE: {
    hint: 'Active customers receiving security services.',
    Icon: Briefcase,
    adminHref: adminWebUrl('/superadmin/customers'),
    adminLabel: 'Customers',
  },
  REVENUE_COLLECTED: {
    hint: '§35.2 revenue — invoice payments collected in the period.',
    Icon: Wallet,
    adminHref: adminWebUrl('/finance'),
    adminLabel: 'Finance invoices',
  },
  CRITICAL_INCIDENTS_OPEN: {
    hint: '§35.2 risk proxy — CRITICAL incidents still OPEN/INVESTIGATING.',
    Icon: AlertTriangle,
    adminHref: adminWebUrl('/branch/incidents'),
    adminLabel: 'Incidents',
  },
  COMPLIANCE_POLICIES_PUBLISHED: {
    hint: 'Published compliance policies (live from compliance schema).',
    Icon: FileCheck2,
    adminHref: adminWebUrl('/compliance'),
    adminLabel: 'Policies',
  },
  COMPLIANCE_BREACHES_OPEN: {
    hint: 'Data breach cases not yet CLOSED (DPO register).',
    Icon: Scale,
    adminHref: adminWebUrl('/compliance'),
    adminLabel: 'Breaches',
  },
  RECRUITMENT_PIPELINE: {
    hint: 'Open job applications (not hired/rejected/withdrawn).',
    Icon: Users,
    adminHref: adminWebUrl('/hr'),
    adminLabel: 'HR / recruitment',
  },
  PARKING_ENTRIES: {
    hint: 'Parking entries recorded in the period.',
    Icon: MapPin,
    adminHref: parkingWebUrl(),
    adminLabel: 'Parking portal',
  },
  PARKING_VIOLATIONS: {
    hint: 'Parking violations in the period.',
    Icon: AlertTriangle,
    adminHref: parkingWebUrl('/violations'),
    adminLabel: 'Violations',
  },
  CONTRACTS_MRR: {
    hint: 'Monthly recurring revenue from ACTIVE contracts.',
    Icon: Wallet,
    adminHref: adminWebUrl('/superadmin/contracts'),
    adminLabel: 'Contracts',
  },
  CONTRACTS_ACTIVE: {
    hint: 'Contracts in ACTIVE status.',
    Icon: FileText,
    adminHref: adminWebUrl('/superadmin/contracts'),
    adminLabel: 'Contracts',
  },
  INVOICE_OUTSTANDING: {
    hint: 'Unpaid / partially paid invoice balance.',
    Icon: CreditCard,
    adminHref: adminWebUrl('/finance'),
    adminLabel: 'Invoices',
  },
  INVOICE_COLLECTED: {
    hint: 'Payments recorded in the selected period.',
    Icon: Wallet,
    adminHref: adminWebUrl('/finance'),
    adminLabel: 'Finance',
  },
  PAYROLL_NET_TOTAL: {
    hint: 'Net payroll from immutable payslip snapshots.',
    Icon: CreditCard,
    adminHref: adminWebUrl('/payroll'),
    adminLabel: 'Payroll',
  },
  PAYROLL_CYCLES_PAID: {
    hint: 'Payroll cycles marked PAID overlapping the period.',
    Icon: CheckCircle2,
    adminHref: adminWebUrl('/payroll'),
    adminLabel: 'Payroll',
  },
};

const CATEGORY_ACTIONS: Record<
  string,
  { label: string; href: string; hint: string }[]
> = {
  OPS: [
    {
      label: 'Branch Ops',
      href: adminWebUrl('/branch'),
      hint: 'Sites · attendance · patrols',
    },
    {
      label: 'Field alerts',
      href: adminWebUrl('/branch/alerts'),
      hint: 'Escalate · acknowledge',
    },
  ],
  ENTERPRISE: [
    {
      label: 'Branch Ops',
      href: adminWebUrl('/branch'),
      hint: 'Branches · sites',
    },
    {
      label: 'Customers',
      href: adminWebUrl('/superadmin/customers'),
      hint: 'Customer 360',
    },
  ],
  SAFETY: [
    {
      label: 'Incidents',
      href: adminWebUrl('/branch/incidents'),
      hint: 'Escalate matrix',
    },
  ],
  ACCESS: [
    {
      label: 'Parking portal',
      href: parkingWebUrl(),
      hint: 'Entries · violations',
    },
  ],
  COMMERCIAL: [
    {
      label: 'Customers',
      href: adminWebUrl('/superadmin/customers'),
      hint: 'Active roster · 360',
    },
    {
      label: 'Contracts',
      href: adminWebUrl('/superadmin/contracts'),
      hint: 'Active · MRR',
    },
  ],
  FINANCE: [
    {
      label: 'Invoices',
      href: adminWebUrl('/finance'),
      hint: 'Outstanding · collect',
    },
  ],
  PAYROLL: [
    {
      label: 'Payroll',
      href: adminWebUrl('/payroll'),
      hint: 'Cycles · snapshots',
    },
  ],
  HR: [
    {
      label: 'HR employees',
      href: adminWebUrl('/hr/employees'),
      hint: 'Active headcount',
    },
  ],
  COMPLIANCE: [
    {
      label: 'Compliance portal',
      href: adminWebUrl('/compliance'),
      hint: 'Policies · breaches',
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
    const alerts = get('FIELD_ALERTS_OPEN') ?? 0;
    if (active > 0) {
      notes.push(
        `Duty coverage ${Math.round((onDuty / active) * 100)}% — ${onDuty}/${active} on duty.`,
      );
    }
    if (typeof approval === 'number') {
      notes.push(`Attendance approval ${approval}%.`);
    }
    notes.push(
      alerts > 0
        ? `${alerts} open field alert${alerts === 1 ? '' : 's'}.`
        : 'No open field alerts.',
    );
  } else {
    notes.push(`${items.length} metrics in this category.`);
    const top = [...items].sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value),
    )[0];
    if (top) notes.push(`Largest signal: ${top.name} = ${formatKpiValue(top)}.`);
  }
  return notes;
}

/** One category analysis panel (used inside tabs). */
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
    soft: 'bg-slate-50 text-slate-700 ring-slate-200',
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
    <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
      <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
        <ul className="max-h-[380px] space-y-0.5 overflow-y-auto p-2 sm:p-3">
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
                      ? 'bg-sky-50 ring-1 ring-sky-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-[#0078d4] text-white'
                        : `ring-1 ${meta.soft}`
                    }`}
                  >
                    <RowIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-medium text-slate-800">
                        {kpi.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {formatKpiValue(kpi)}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={`block h-full rounded-full ${meta.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-[#0078d4]' : 'text-slate-300'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-3 bg-slate-50/70 p-3 sm:p-4">
        {selected ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${meta.soft}`}
                  >
                    <SelectedIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Selected metric
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selected.name}
                    </h3>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
                      {selectedMeta?.hint ?? `${category} KPI · live reporting.`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {formatKpiValue(selected)}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold uppercase text-sky-700 ring-1 ring-sky-100">
                    {selected.source}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Insights
              </p>
              <ul className="mt-2 space-y-1.5">
                {insights.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-sm leading-relaxed text-slate-700"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.bar}`}
                    />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Detail · drill-down
                </p>
                {drillLoading ? (
                  <p className="text-base text-slate-500">Loading…</p>
                ) : null}
                {drillError ? (
                  <p className="text-sm text-rose-600">{drillError}</p>
                ) : null}
                {drill?.breakdown && Array.isArray(drill.breakdown.items) ? (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                    {(
                      drill.breakdown.items as Array<Record<string, unknown>>
                    ).map((row, idx) => {
                      const code = String(row.code ?? '');
                      const name = String(row.name ?? '');
                      const extra =
                        row.siteCount != null
                          ? `${row.siteCount} sites`
                          : row.branchCode
                            ? String(row.branchCode)
                            : row.region
                              ? String(row.region)
                              : null;
                      return (
                        <li
                          key={`${code}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-100"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-semibold text-slate-800">
                              {code}
                            </span>{' '}
                            <span className="text-slate-500">{name}</span>
                          </span>
                          {extra ? (
                            <span className="shrink-0 text-slate-400">
                              {extra}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {drill && drill.bySite.length > 0 ? (
                  <ul className="max-h-36 space-y-2 overflow-y-auto">
                    {(() => {
                      const siteMax = Math.max(
                        ...drill.bySite.map((s) => s.value),
                        1,
                      );
                      return drill.bySite.slice(0, 8).map((s) => (
                        <li key={s.siteId}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-slate-700">
                              {s.siteCode}{' '}
                              <span className="font-normal text-slate-500">
                                {s.siteName}
                              </span>
                            </span>
                            <span className="tabular-nums font-semibold text-slate-900">
                              {s.value.toLocaleString('en-TZ')}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
                ) : !drillLoading &&
                  !drillError &&
                  !(
                    drill?.breakdown && Array.isArray(drill.breakdown.items)
                  ) ? (
                  <p className="text-base text-slate-500">
                    {drill?.notes?.[0] ?? 'No site rows for this metric.'}
                  </p>
                ) : null}
              </div>
            </div>

            {(selectedMeta?.adminHref || actions.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {selectedMeta?.adminHref ? (
                  <a
                    href={selectedMeta.adminHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                  >
                    {selectedMeta.adminLabel ?? 'Open related'}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {actions.map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {a.label}
                    <ExternalLink className="h-3.5 w-3.5 text-[#0078d4]" />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-base text-slate-500">No metrics in this category.</p>
        )}
      </div>
    </div>
  );
}

/** Tabbed category workbench — keeps page short (one category at a time). */
export function CategoryWorkbench({
  byCategory,
  token,
  from,
  to,
  activeCategory,
  onCategoryChange,
}: {
  byCategory: readonly (readonly [string, KpiItem[]])[];
  token: string | null;
  from: string;
  to: string;
  activeCategory: string;
  onCategoryChange: (code: string) => void;
}) {
  const active =
    byCategory.find(([c]) => c === activeCategory) ?? byCategory[0];
  if (!active) return null;
  const [cat, items] = active;
  const meta = CATEGORY_META[cat];

  return (
    <section
      id="exec-analysis"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 px-4 pt-4 sm:px-5">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${meta?.soft ?? 'bg-slate-50 text-slate-700 ring-slate-200'}`}
          >
            {meta ? (
              <meta.Icon className="h-4 w-4" />
            ) : (
              <LayoutDashboard className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              KPI analysis
            </h2>
            <p className="text-base text-slate-500">
              Pick a domain tab · select a metric · drill-down
            </p>
          </div>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-px">
          {byCategory.map(([code, list]) => {
            const m = CATEGORY_META[code];
            const on = code === cat;
            return (
              <button
                key={code}
                type="button"
                onClick={() => onCategoryChange(code)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                  on
                    ? 'border-[#0078d4] text-[#0078d4]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {m ? <m.Icon className="h-3.5 w-3.5" /> : null}
                {m?.label ?? code}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    on
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {list.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <CategoryPanel
        category={cat}
        items={items}
        token={token}
        from={from}
        to={to}
      />
    </section>
  );
}

type FootprintRow = {
  code: string;
  name: string;
  detail?: string;
};

function footprintItems(kpi: KpiItem | undefined): FootprintRow[] {
  const raw = kpi?.breakdown?.items;
  if (!Array.isArray(raw)) return [];
  const rows: FootprintRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const code = String(r.code ?? '');
    const name = String(r.name ?? '');
    if (!code && !name) continue;
    const detail =
      r.siteCount != null
        ? `${r.siteCount} site${Number(r.siteCount) === 1 ? '' : 's'}`
        : r.branchCode
          ? String(r.branchCode)
          : r.region
            ? String(r.region)
            : undefined;
    rows.push({ code, name, detail });
  }
  return rows;
}

function FootprintList({
  title,
  subtitle,
  Icon,
  tone,
  rows,
  empty,
  badgeClass,
}: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  tone: string;
  rows: FootprintRow[];
  empty: string;
  badgeClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-900">{title}</p>
          <p className="text-base text-slate-500">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
          {empty}
        </p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.code}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {row.name}
                </span>
                <span className="font-mono text-base text-slate-500">
                  {row.code}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
              >
                {row.detail ?? 'Active'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FootprintPanel({ kpis }: { kpis: KpiItem[] }) {
  const branchesKpi = findKpi(kpis, 'BRANCHES_ACTIVE');
  const customersKpi = findKpi(kpis, 'CUSTOMERS_ACTIVE');
  const sitesKpi = findKpi(kpis, 'SITES_ACTIVE');
  const branches = footprintItems(branchesKpi);
  const customers = footprintItems(customersKpi);

  return (
    <section id="exec-footprint" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Branches & customers
          </h2>
          <p className="text-base text-slate-500">
            {branchesKpi?.value ?? 0} branches · {sitesKpi?.value ?? 0} sites ·{' '}
            {customersKpi?.value ?? 0} customers
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FootprintList
          title="Branches"
          subtitle="Active footprint"
          Icon={Building2}
          tone="bg-indigo-100 text-indigo-700"
          rows={branches}
          empty="No active branches"
          badgeClass="bg-indigo-50 text-indigo-700"
        />
        <FootprintList
          title="Customers"
          subtitle="Active commercial accounts"
          Icon={Briefcase}
          tone="bg-emerald-100 text-emerald-700"
          rows={customers}
          empty="No active customers"
          badgeClass="bg-emerald-50 text-emerald-700"
        />
      </div>
    </section>
  );
}

/** §35.2 coverage map — live KPI + portal deep-link for each design topic. */
export function DomainCoveragePanel({
  kpis,
  onOpenCategory,
}: {
  kpis: KpiItem[];
  onOpenCategory: (category: string) => void;
}) {
  const rows: {
    label: string;
    design: string;
    code: string;
    category: string;
    href: string;
    hrefLabel: string;
  }[] = [
    {
      label: 'Branches',
      design: 'branches',
      code: 'BRANCHES_ACTIVE',
      category: 'ENTERPRISE',
      href: adminWebUrl('/branch'),
      hrefLabel: 'Branch Ops',
    },
    {
      label: 'Customers',
      design: 'customers',
      code: 'CUSTOMERS_ACTIVE',
      category: 'COMMERCIAL',
      href: adminWebUrl('/superadmin/customers'),
      hrefLabel: 'Customers',
    },
    {
      label: 'Contracts',
      design: 'contracts',
      code: 'CONTRACTS_ACTIVE',
      category: 'COMMERCIAL',
      href: adminWebUrl('/superadmin/contracts'),
      hrefLabel: 'Contracts',
    },
    {
      label: 'Revenue',
      design: 'revenue',
      code: 'REVENUE_COLLECTED',
      category: 'FINANCE',
      href: adminWebUrl('/finance'),
      hrefLabel: 'Finance',
    },
    {
      label: 'Guard deployment',
      design: 'guard deployment',
      code: 'DEPLOYMENTS_ACTIVE',
      category: 'OPS',
      href: adminWebUrl('/branch/deployments'),
      hrefLabel: 'Deployments',
    },
    {
      label: 'Payroll',
      design: 'payroll status',
      code: 'PAYROLL_CYCLES_PAID',
      category: 'PAYROLL',
      href: adminWebUrl('/payroll'),
      hrefLabel: 'Payroll',
    },
    {
      label: 'Unpaid invoices',
      design: 'unpaid invoices',
      code: 'INVOICE_OUTSTANDING',
      category: 'FINANCE',
      href: adminWebUrl('/finance'),
      hrefLabel: 'Invoices',
    },
    {
      label: 'Incidents',
      design: 'incidents',
      code: 'OPEN_INCIDENTS',
      category: 'SAFETY',
      href: adminWebUrl('/branch/incidents'),
      hrefLabel: 'Incidents',
    },
    {
      label: 'Risks',
      design: 'risks',
      code: 'CRITICAL_INCIDENTS_OPEN',
      category: 'SAFETY',
      href: adminWebUrl('/branch/incidents'),
      hrefLabel: 'Critical',
    },
    {
      label: 'Recruitment',
      design: 'recruitment',
      code: 'RECRUITMENT_PIPELINE',
      category: 'HR',
      href: adminWebUrl('/hr'),
      hrefLabel: 'HR',
    },
    {
      label: 'Parking',
      design: 'parking performance',
      code: 'PARKING_ENTRIES',
      category: 'ACCESS',
      href: parkingWebUrl(),
      hrefLabel: 'Parking',
    },
    {
      label: 'Compliance',
      design: 'compliance reports',
      code: 'COMPLIANCE_BREACHES_OPEN',
      category: 'COMPLIANCE',
      href: adminWebUrl('/compliance'),
      hrefLabel: 'Compliance',
    },
  ];

  return (
    <section id="exec-coverage" className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Design §35.2 coverage
        </h2>
        <p className="text-base text-slate-500">
          Live KPIs from reporting-service · open portal for detail
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {rows.map((row) => {
          const kpi = findKpi(kpis, row.code);
          return (
            <div
              key={row.code}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {row.label}
                  </p>
                  <p className="text-sm text-slate-400">{row.design}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-100">
                  {kpi ? formatKpiValue(kpi) : '—'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenCategory(row.category)}
                  className="rounded-lg bg-sky-50 px-2 py-1 text-sm font-semibold text-sky-800 ring-1 ring-sky-100 transition hover:bg-sky-100"
                >
                  Analyze
                </button>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  {row.hrefLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
