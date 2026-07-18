import type { KpiItem } from '@pssms/api-client';
import type { ReactNode } from 'react';

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f6fa] text-[#323130]">
      <header className="bg-gradient-to-r from-[#0b1f3a] via-[#0e2f52] to-[#123a63] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-[#0078d4] text-[12px] font-bold shadow">
              HL
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-300">
                HIGHLINK PSSMS
              </p>
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-slate-300">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

export function KpiCard({ kpi }: { kpi: KpiItem }) {
  const formatted =
    kpi.unit === 'TZS'
      ? new Intl.NumberFormat('en-TZ', {
          style: 'currency',
          currency: 'TZS',
          maximumFractionDigits: 0,
        }).format(kpi.value)
      : kpi.unit === 'PERCENT'
        ? `${kpi.value}%`
        : new Intl.NumberFormat('en-TZ').format(kpi.value);

  return (
    <article className="rounded-xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {kpi.category}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            kpi.source === 'snapshot'
              ? 'bg-[#dff6dd] text-[#0e700e]'
              : 'bg-[#eff6fc] text-[#005a9e]'
          }`}
        >
          {kpi.source}
        </span>
      </div>
      <h3 className="text-sm font-medium text-slate-700">{kpi.name}</h3>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{formatted}</p>
      <p className="mt-2 text-[11px] text-slate-400">{kpi.code}</p>
    </article>
  );
}

export function KpiGrid({ kpis }: { kpis: KpiItem[] }) {
  const byCategory = kpis.reduce<Record<string, KpiItem[]>>((acc, kpi) => {
    acc[kpi.category] = acc[kpi.category] ?? [];
    acc[kpi.category].push(kpi);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
            {category}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((kpi) => (
              <KpiCard key={kpi.code} kpi={kpi} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export {
  AdminShell,
  CustomerShell,
  SupplierShell,
  ParkingShell,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  Modal,
  btnPrimary,
  btnSecondary,
  inputCls,
} from './admin';

export {
  GlassCard,
  ConsoleSectionHeader,
  SectionTitle,
  StatCard,
  MetricStatCard,
  RiskGauge,
  SeverityRings,
  RegionFootprint,
  StackedBarPanel,
  TrendAreaChart,
  StatusListCard,
} from './console';
export type {
  MetricTrend,
  SeverityItem,
  RegionStat,
  StackedBarPoint,
  TrendPoint,
  StatAccent,
} from './console';

export {
  AZURE,
  AzureGlyph,
  ServiceIcon,
  QuickTile,
  ServiceTile,
  CategorySection,
  moduleVisual,
  shade,
} from './azure';
export type { GlyphName } from './azure';
