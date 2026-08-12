'use client';

import {
  downloadExecutiveExport,
  getExecutiveDashboard,
  getReportingHealth,
  refreshKpis,
  refreshSession,
  type KpiItem,
} from '@pssms/api-client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  REFRESH_KEY,
  TOKEN_KEY,
  USER_KEY,
  clearExecutiveSession,
  isUnauthorizedError,
} from '@/lib/auth';
import {
  CategoryWorkbench,
  DomainCoveragePanel,
  ExecChrome,
  FootprintPanel,
  SPOTLIGHT_CODES,
  SpotlightTile,
  findKpi,
  roleViewLabel,
} from '../_components/exec-ui';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return ymd(new Date());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

type PeriodPreset = 'today' | '7d' | 'mtd' | 'custom';

const CATEGORY_ORDER = [
  'ENTERPRISE',
  'OPS',
  'SAFETY',
  'ACCESS',
  'COMMERCIAL',
  'FINANCE',
  'PAYROLL',
  'HR',
  'COMPLIANCE',
];

const CODE_TO_CATEGORY: Record<string, string> = {
  BRANCHES_ACTIVE: 'ENTERPRISE',
  CUSTOMERS_ACTIVE: 'COMMERCIAL',
  CONTRACTS_ACTIVE: 'COMMERCIAL',
  REVENUE_COLLECTED: 'FINANCE',
  DEPLOYMENTS_ACTIVE: 'OPS',
  GUARD_HEADCOUNT_ACTIVE: 'OPS',
  GUARD_ON_DUTY: 'OPS',
  OPEN_INCIDENTS: 'SAFETY',
  CRITICAL_INCIDENTS_OPEN: 'SAFETY',
  CONTRACTS_MRR: 'COMMERCIAL',
  INVOICE_OUTSTANDING: 'FINANCE',
  COMPLIANCE_BREACHES_OPEN: 'COMPLIANCE',
  COMPLIANCE_POLICIES_PUBLISHED: 'COMPLIANCE',
  RECRUITMENT_PIPELINE: 'HR',
  PARKING_ENTRIES: 'ACCESS',
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [roleLabel, setRoleLabel] = useState('Executive view');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState<PeriodPreset>('mtd');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>('…');
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('ENTERPRISE');

  const forceLogin = useCallback(
    (reason: string) => {
      clearExecutiveSession();
      setToken(null);
      router.replace(`/login?reason=${encodeURIComponent(reason)}`);
    },
    [router],
  );

  const load = useCallback(
    async (accessToken: string, retried = false) => {
      setLoading(true);
      setError(null);
      try {
        const [dashboard, healthRes] = await Promise.all([
          getExecutiveDashboard(accessToken, { from, to }),
          getReportingHealth(accessToken),
        ]);
        setKpis(dashboard.kpis);
        setHealth(
          `${healthRes.status} · analytics ${healthRes.analyticsAi.status}`,
        );
        setToken(accessToken);
      } catch (err) {
        if (isUnauthorizedError(err) && !retried) {
          const refresh = sessionStorage.getItem(REFRESH_KEY);
          if (refresh) {
            try {
              const tokens = await refreshSession(refresh);
              sessionStorage.setItem(TOKEN_KEY, tokens.accessToken);
              sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
              await load(tokens.accessToken, true);
              return;
            } catch {
              forceLogin('session_expired');
              return;
            }
          }
          forceLogin('session_expired');
          return;
        }
        setError(
          err instanceof Error ? err.message : 'Failed to load dashboard',
        );
      } finally {
        setLoading(false);
      }
    },
    [from, to, forceLogin],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (!stored) {
      router.replace('/login?reason=required');
      return;
    }
    setToken(stored);
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw) as {
          fullName: string;
          roles?: string[];
        };
        setUserName(user.fullName);
        setRoleLabel(roleViewLabel(user.roles ?? []));
      } catch {
        /* ignore */
      }
    }
    void load(stored);
  }, [router, load]);

  function logout() {
    clearExecutiveSession();
    router.push('/login');
  }

  function applyPreset(p: PeriodPreset) {
    setPreset(p);
    if (p === 'today') {
      setFrom(today());
      setTo(today());
    } else if (p === '7d') {
      setFrom(daysAgo(6));
      setTo(today());
    } else if (p === 'mtd') {
      setFrom(monthStart());
      setTo(today());
    }
  }

  async function onRefresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await refreshKpis(token, { from, to });
      await load(token);
    } catch (err) {
      if (isUnauthorizedError(err)) {
        forceLogin('session_expired');
        return;
      }
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function onExport(format: 'csv' | 'xlsx' | 'pdf') {
    if (!token) return;
    try {
      const blob = await downloadExecutiveExport(token, format, { from, to });
      const ext = format === 'xlsx' ? 'xlsx' : format;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `executive-dashboard-${to}.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(`${format.toUpperCase()} export failed`);
    }
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, KpiItem[]>();
    for (const kpi of kpis) {
      const list = map.get(kpi.category) ?? [];
      list.push(kpi);
      map.set(kpi.category, list);
    }
    const ordered = CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const,
    );
    for (const [c, items] of map) {
      if (!CATEGORY_ORDER.includes(c)) ordered.push([c, items]);
    }
    return ordered;
  }, [kpis]);

  const spotlight = useMemo(() => {
    return SPOTLIGHT_CODES.map((code) => findKpi(kpis, code)).filter(
      (k): k is KpiItem => !!k,
    );
  }, [kpis]);

  useEffect(() => {
    if (
      byCategory.length &&
      !byCategory.some(([c]) => c === activeCategory)
    ) {
      setActiveCategory(byCategory[0]![0]);
    }
  }, [byCategory, activeCategory]);

  function jumpToCategory(category: string) {
    setActiveCategory(category);
    requestAnimationFrame(() => {
      document
        .getElementById('exec-analysis')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const presetBtn = (p: PeriodPreset, label: string) => (
    <button
      key={p}
      type="button"
      onClick={() => applyPreset(p)}
      className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
        preset === p
          ? 'bg-[#0078d4] text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <ExecChrome
      userName={userName}
      roleLabel={roleLabel}
      health={health}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      onExport={(f) => void onExport(f)}
      onLogout={logout}
      period={
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mr-auto min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Reporting period
            </p>
            <p className="text-base font-medium text-slate-800">
              {roleLabel} · company-wide
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {presetBtn('today', 'Today')}
            {presetBtn('7d', '7 days')}
            {presetBtn('mtd', 'MTD')}
            {presetBtn('custom', 'Custom')}
          </div>
          <label className="text-sm font-medium text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20"
            />
          </label>
          <label className="text-sm font-medium text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20"
            />
          </label>
          <button
            type="button"
            onClick={() => token && void load(token)}
            className="rounded-lg bg-[#0078d4] px-3.5 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-[#106ebe]"
          >
            Apply
          </button>
        </div>
      }
    >
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-base text-slate-500 shadow-sm">
          Loading executive KPIs…
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  At a glance
                </h2>
                <p className="text-base text-slate-500">
                  Priority signals · click a card to open analysis
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
              {spotlight.map((kpi) => (
                <SpotlightTile
                  key={kpi.code}
                  kpi={kpi}
                  onClick={() =>
                    jumpToCategory(
                      CODE_TO_CATEGORY[kpi.code] ?? kpi.category,
                    )
                  }
                />
              ))}
            </div>
          </section>

          <FootprintPanel kpis={kpis} />

          <DomainCoveragePanel
            kpis={kpis}
            onOpenCategory={jumpToCategory}
          />

          <CategoryWorkbench
            byCategory={byCategory}
            token={token}
            from={from}
            to={to}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          <p className="text-center text-sm text-slate-400">
            HIGHLINK · Portal 35.2 · live KPIs across domains · portal deep-links
          </p>
        </>
      )}
    </ExecChrome>
  );
}
