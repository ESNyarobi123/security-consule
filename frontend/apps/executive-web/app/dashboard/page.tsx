'use client';

import {
  downloadExecutiveExport,
  getExecutiveDashboard,
  getReportingHealth,
  refreshKpis,
} from '@pssms/api-client';
import { KpiGrid, Shell } from '@pssms/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TOKEN_KEY, USER_KEY } from '@/lib/auth';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>('…');
  const [kpis, setKpis] = useState<
    Awaited<ReturnType<typeof getExecutiveDashboard>>['kpis']
  >([]);

  const load = useCallback(async (accessToken: string) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (!stored) {
      router.replace('/login');
      return;
    }
    setToken(stored);
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw) as { fullName: string };
        setUserName(user.fullName);
      } catch {
        /* ignore */
      }
    }
    void load(stored);
  }, [router, load]);

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    router.push('/login');
  }

  async function onRefresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await refreshKpis(token, { from, to });
      await load(token);
    } catch (err) {
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

  return (
    <Shell
      title="Executive Dashboard"
      subtitle={userName ? `Welcome, ${userName}` : undefined}
      actions={
        <>
          <span className="rounded-full border border-white/25 px-3 py-1 text-xs text-slate-200">
            {health}
          </span>
          <button
            type="button"
            onClick={() => void onExport('csv')}
            className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => void onExport('xlsx')}
            className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => void onExport('pdf')}
            className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="rounded-md bg-[#0078d4] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2b88d8] disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh KPIs'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
          >
            Logout
          </button>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
        <label className="text-sm text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
          />
        </label>
        <label className="text-sm text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
          />
        </label>
        <button
          type="button"
          onClick={() => token && void load(token)}
          className="rounded-md border border-[#8a8886] bg-white px-4 py-2 text-sm text-[#323130] transition hover:bg-[#f3f2f1]"
        >
          Apply period
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading KPIs…</p>
      ) : (
        <KpiGrid kpis={kpis} />
      )}
    </Shell>
  );
}
