'use client';

import {
  downloadExecutiveExport,
  getExecutiveDashboard,
  getReportingHealth,
  refreshKpis,
  refreshSession,
  type KpiItem,
} from '@pssms/api-client';
import {
  AlertTriangle,
  Briefcase,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
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
  CategoryPanel,
  ExecChrome,
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

const SPOTLIGHT_VISUAL: Record<
  string,
  {
    accent: 'sky' | 'emerald' | 'rose' | 'amber' | 'teal' | 'blue';
    Icon: typeof Shield;
    category: string;
  }
> = {
  GUARD_HEADCOUNT_ACTIVE: { accent: 'sky', Icon: Shield, category: 'OPS' },
  GUARD_ON_DUTY: { accent: 'teal', Icon: Users, category: 'OPS' },
  OPEN_INCIDENTS: { accent: 'rose', Icon: AlertTriangle, category: 'SAFETY' },
  CONTRACTS_ACTIVE: { accent: 'emerald', Icon: Briefcase, category: 'COMMERCIAL' },
  CONTRACTS_MRR: { accent: 'blue', Icon: Briefcase, category: 'COMMERCIAL' },
  INVOICE_OUTSTANDING: { accent: 'amber', Icon: Wallet, category: 'FINANCE' },
};

const CATEGORY_ORDER = [
  'OPS',
  'SAFETY',
  'ACCESS',
  'COMMERCIAL',
  'FINANCE',
  'PAYROLL',
  'HR',
];

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

  function jumpToCategory(category: string) {
    const el = document.getElementById(`exec-cat-${category}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const presetBtn = (p: PeriodPreset, label: string) => (
    <button
      key={p}
      type="button"
      onClick={() => applyPreset(p)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        preset === p
          ? 'bg-[#0078d4] text-white shadow-sm'
          : 'border border-[#e1dfdd] bg-white text-[#323130] hover:bg-[#f3f2f1]'
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
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e1dfdd] bg-white px-4 py-3.5 shadow-sm sm:px-5">
          <div className="mr-auto min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">
              Reporting period
            </p>
            <p className="text-sm text-[#323130]">
              {roleLabel} · company-wide KPIs
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presetBtn('today', 'Today')}
              {presetBtn('7d', '7 days')}
              {presetBtn('mtd', 'MTD')}
              {presetBtn('custom', 'Custom')}
            </div>
          </div>
          <label className="text-xs font-medium text-[#605e5c]">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
              className="mt-1 block rounded-lg border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            />
          </label>
          <label className="text-xs font-medium text-[#605e5c]">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
              className="mt-1 block rounded-lg border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            />
          </label>
          <button
            type="button"
            onClick={() => token && void load(token)}
            className="rounded-lg bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#106ebe]"
          >
            Apply period
          </button>
        </div>
      }
    >
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#e1dfdd] bg-white px-6 py-16 text-center text-sm text-[#605e5c]">
          Loading executive KPIs…
        </div>
      ) : (
        <>
          <section
            className="overflow-hidden rounded-2xl p-4 shadow-md sm:p-5"
            style={{
              background: `linear-gradient(125deg, #071525 0%, #12263f 45%, #0b4f7a 100%)`,
              border: '1px solid rgba(56, 189, 248, 0.28)',
            }}
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
                  At a glance
                </p>
                <h2 className="text-base font-semibold text-white">
                  Priority company signals
                </h2>
              </div>
              <p className="text-[11px] text-slate-400">
                Click a tile → jump to category · select metric for site drill-down
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {spotlight.map((kpi) => {
                const v = SPOTLIGHT_VISUAL[kpi.code] ?? {
                  accent: 'sky' as const,
                  Icon: Shield,
                  category: kpi.category,
                };
                return (
                  <button
                    key={kpi.code}
                    type="button"
                    className="text-left"
                    onClick={() => jumpToCategory(v.category)}
                  >
                    <SpotlightTile
                      kpi={kpi}
                      accent={v.accent}
                      Icon={v.Icon}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            {byCategory.map(([category, items]) => (
              <div key={category} id={`exec-cat-${category}`}>
                <CategoryPanel
                  category={category}
                  items={items}
                  token={token}
                  from={from}
                  to={to}
                />
              </div>
            ))}
          </div>

          <p className="rounded-xl border border-[#e1dfdd] bg-white px-4 py-3 text-[11px] leading-relaxed text-[#605e5c]">
            Executive Portal 35.2 — period presets + live KPI drill-down by site
            (`GET /reporting/kpis/:code/drilldown`). No fake trends. Charts /
            risk register deferred.
          </p>
        </>
      )}
    </ExecChrome>
  );
}
