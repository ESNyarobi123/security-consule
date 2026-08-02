'use client';

import {
  getCustomerPortalAttendanceSummary,
  type PortalAttendanceSummary,
} from '@pssms/api-client';
import {
  ClipboardList,
  RefreshCw,
  Radio,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AvatarBadge,
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  formatDate,
  initials,
} from '../../_components/portal-ui';

const AUTO_REFRESH_MS = 30_000;

function timeOnly(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AttendancePage() {
  const [rows, setRows] = useState<PortalAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setRows(await getCustomerPortalAttendanceSummary());
      setLastSynced(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load attendance summary',
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void load(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.clocked += r.clockedInToday;
        acc.onDuty += r.onDutyNow ?? r.clockedGuards?.filter((g) => g.stillOnDuty).length ?? 0;
        acc.deployed += r.totalActiveDeployments;
        return acc;
      },
      { clocked: 0, onDuty: 0, deployed: 0 },
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.siteCode.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        (r.clockedGuards ?? []).some(
          (g) =>
            (g.fullName ?? '').toLowerCase().includes(q) ||
            g.guardNumber.toLowerCase().includes(q),
        ),
    );
  }, [rows, search]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Services · Portal 35.8"
        title="Guard attendance"
        subtitle="Live site coverage for officers serving your premises — refreshes every 30 seconds while this page is open."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ${
                autoRefresh
                  ? 'bg-teal-500/25 text-white ring-teal-200/40'
                  : 'bg-white/10 text-white/80 ring-white/25'
              }`}
            >
              <Radio className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#605e5c]">
        <p>
          {lastSynced
            ? `Last synced ${formatDate(lastSynced.toISOString(), true)}`
            : 'Not synced yet'}
          {autoRefresh ? ' · auto-refresh 30s' : ' · auto-refresh off'}
        </p>
        <p className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Aggregates only — no biometrics or alertness detail
        </p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat label="Sites" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat
          label="Clocked in today"
          value={loading ? '—' : totals.clocked}
          tone="teal"
        />
        <PortalStat
          label="On duty now"
          value={loading ? '—' : totals.onDuty}
          tone="amber"
        />
        <PortalStat
          label="Active deployments"
          value={loading ? '—' : totals.deployed}
          tone="violet"
        />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search site or guard…"
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No attendance summary"
          description={
            error
              ? 'Could not load summary. Retry when the portal attendance API is available.'
              : 'Site-level clock-in vs deployment counts will appear once officers are deployed to your sites.'
          }
          icon={<ClipboardList className="h-4 w-4" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => {
            const guards = r.clockedGuards ?? [];
            const onDuty =
              r.onDutyNow ?? guards.filter((g) => g.stillOnDuty).length;
            const coverage =
              r.totalActiveDeployments > 0
                ? Math.min(
                    100,
                    Math.round((onDuty / r.totalActiveDeployments) * 100),
                  )
                : 0;
            return (
              <article
                key={r.siteId}
                className="rounded-2xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-teal-400/50 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-[#8a8886]">
                      {r.siteCode}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-[#1b1a19]">
                      {r.siteName}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      coverage >= 80
                        ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                        : coverage >= 40
                          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                          : 'bg-[#f3f2f1] text-[#605e5c] ring-1 ring-[#e1dfdd]'
                    }`}
                  >
                    {coverage}% on post
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-teal-50/80 px-3 py-2 ring-1 ring-teal-100">
                    <p className="text-[10px] font-semibold uppercase text-teal-800">
                      Today
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-teal-900">
                      {r.clockedInToday}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50/80 px-3 py-2 ring-1 ring-amber-100">
                    <p className="text-[10px] font-semibold uppercase text-amber-900">
                      On duty
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-amber-950">
                      {onDuty}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50/80 px-3 py-2 ring-1 ring-sky-100">
                    <p className="text-[10px] font-semibold uppercase text-sky-800">
                      Deployed
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-sky-900">
                      {r.totalActiveDeployments}
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edebe9]">
                  <div
                    className="h-full rounded-full bg-[#0d9488] transition-all"
                    style={{ width: `${coverage}%` }}
                  />
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    Clocked in today
                  </p>
                  {guards.length === 0 ? (
                    <p className="mt-2 text-sm text-[#8a8886]">
                      No officers clocked in at this site yet today.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-[#f3f2f1]">
                      {guards.map((g) => (
                        <li
                          key={`${r.siteId}-${g.guardId}`}
                          className="flex items-center justify-between gap-3 py-2.5 first:pt-1"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AvatarBadge
                              seed={g.guardId}
                              label={initials(g.fullName || g.guardNumber, 'G')}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1b1a19]">
                                {g.fullName || g.guardNumber}
                              </p>
                              <p className="font-mono text-[11px] text-[#8a8886]">
                                {g.guardNumber}
                                {' · in '}
                                {timeOnly(g.clockInAt)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              g.stillOnDuty
                                ? 'bg-teal-50 text-teal-800'
                                : 'bg-[#f3f2f1] text-[#605e5c]'
                            }`}
                          >
                            {g.stillOnDuty ? 'On duty' : 'Off'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PortalDeferral note="Near-live via 30s poll (not SSE yet). Alertness, GPS tracks and device logs stay inside HIGHLINK operations." />
    </div>
  );
}
