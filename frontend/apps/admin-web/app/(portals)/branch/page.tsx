'use client';

import {
  getBranchDeskSummary,
  listBranches,
  listDeployments,
  listFieldAlerts,
  listShifts,
  listSites,
  type BranchDeskSummary,
  type Deployment,
  type Site,
} from '@pssms/api-client';
import { AZURE, DataTable, StatusBadge } from '@pssms/ui';
import {
  Bell,
  Building2,
  MapPin,
  RotateCw,
  Shield,
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from './_components/BranchShell';
import {
  HERO_CHIPS,
  KpiCard,
  QUICK_LINKS,
  QuickLinkCard,
  WALL,
} from './_components/overview-shared';
import { formatApiError, formatDate, shortId } from './_components/shared';

export default function BranchOverviewPage() {
  const [branches, setBranches] = useState<
    Awaited<ReturnType<typeof listBranches>>
  >([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [shifts, setShifts] = useState<
    Awaited<ReturnType<typeof listShifts>>
  >([]);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [desk, setDesk] = useState<BranchDeskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, s, d, sh, alerts, summary] = await Promise.all([
        listBranches(),
        listSites(),
        listDeployments(),
        listShifts(),
        listFieldAlerts({ acknowledged: false }),
        getBranchDeskSummary().catch(() => null),
      ]);
      setBranches(b);
      setSites(s);
      setDeployments(d);
      setShifts(sh);
      setOpenAlerts(alerts.length);
      setDesk(summary);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, `${s.code} · ${s.name}`);
    return m;
  }, [sites]);

  const stats = useMemo(() => {
    const activeBranches = branches.filter((r) => r.isActive).length;
    const activeDeployments = deployments
      .filter((r) => r.status === 'ACTIVE')
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.startDate).getTime();
        const tb = new Date(b.startDate).getTime();
        return tb - ta;
      });
    return {
      branches: branches.length,
      activeBranches,
      sites: sites.length,
      activeDeployments: activeDeployments.length,
      shifts: shifts.length,
      openAlerts,
      recentActive: activeDeployments.slice(0, 5),
    };
  }, [branches, sites, deployments, shifts, openAlerts]);

  return (
    <div className="pb-6">
      {/* Navy → teal control-room hero */}
      <section
        className="relative mb-4 overflow-hidden rounded-2xl shadow-md"
        style={{
          background: `linear-gradient(125deg, #071525 0%, ${AZURE.navy} 42%, #0b4f7a 78%, #0e7490 100%)`,
          border: '1px solid rgba(56, 189, 248, 0.28)',
        }}
      >
        <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-2 ring-white/15"
                style={{
                  background:
                    'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
                }}
              >
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-300/30">
                    Portal 35.23
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                    Branch &amp; Field · §27
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  Branch Operations
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  BOM / Field / Ops Mgr supervise sites, staff on post,
                  attendance, inspections, incidents, and branch petty cash
                  requests. Parking is a monitor — mutate stays parking-web.
                  Marketing / CCTV technical stay their own portals.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {HERO_CHIPS.map((chip) =>
                    chip.href ? (
                      <Link
                        key={chip.label}
                        href={chip.href}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/15"
                      >
                        {chip.label}
                      </Link>
                    ) : (
                      <span
                        key={chip.label}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10"
                      >
                        {chip.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/operations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Ops Console →
              </Link>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300 disabled:opacity-60"
              >
                <RotateCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              label="Branches"
              value={loading ? '…' : stats.branches}
              hint={`${stats.activeBranches} active`}
              tone="sky"
              icon={<Building2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Sites"
              value={loading ? '…' : stats.sites}
              hint="Org facilities"
              tone="teal"
              icon={<MapPin className="h-4 w-4" />}
            />
            <KpiCard
              label="Active deployments"
              value={loading ? '…' : stats.activeDeployments}
              hint={`${deployments.length} total listed`}
              tone="emerald"
              icon={<Shield className="h-4 w-4" />}
            />
            <KpiCard
              label="Shifts"
              value={loading ? '…' : stats.shifts}
              hint={`${shifts.length} total listed`}
              tone="amber"
              icon={<Timer className="h-4 w-4" />}
            />
            <KpiCard
              label="Open field alerts"
              value={loading ? '…' : stats.openAlerts}
              hint="Unacknowledged"
              tone={stats.openAlerts > 0 ? 'rose' : 'slate'}
              pulse={stats.openAlerts > 0}
              icon={<Bell className="h-4 w-4" />}
            />
            <KpiCard
              label="Guards on post"
              value={loading ? '…' : (desk?.deployedGuards ?? '—')}
              hint="Active deployments in scope"
              tone="emerald"
              icon={<Shield className="h-4 w-4" />}
            />
            <KpiCard
              label="Parking denies (24h)"
              value={loading ? '…' : (desk?.parkingDenies24h ?? '—')}
              hint="Read-only monitor"
              tone={(desk?.parkingDenies24h ?? 0) > 0 ? 'rose' : 'slate'}
              icon={<Bell className="h-4 w-4" />}
            />
            <KpiCard
              label="Pending petty cash"
              value={loading ? '…' : (desk?.pendingPettyCash ?? '—')}
              hint="Finance still issues"
              tone="amber"
              icon={<Timer className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      <BranchShell variant="overview">
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
          >
            <p className="font-semibold">Could not load branch overview</p>
            <p className="mt-0.5 text-xs text-rose-800/90">{error}</p>
          </div>
        ) : null}

        {/* Quick links */}
        <section className="mb-5">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1b1a19]">
              Quick links
            </h2>
            <p className="text-[11px] text-[#605e5c]">
              Jump to thin ops boards · portal 35.23
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {QUICK_LINKS.map((link) => (
              <QuickLinkCard key={link.href} {...link} />
            ))}
          </div>
        </section>

        {/* Recent ACTIVE deployments */}
        {stats.recentActive.length > 0 ? (
          <section
            className="mb-5 overflow-hidden rounded-xl shadow-md"
            style={{
              background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
              border: `1px solid ${WALL.borderStrong}`,
            }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: `1px solid ${WALL.border}` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: WALL.muted }}
                >
                  Active deployments · latest{' '}
                  {stats.recentActive.length}
                </p>
              </div>
              <Link
                href="/branch/deployments"
                className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
              >
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-white/5">
              {stats.recentActive.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {siteMap.get(d.siteId) ?? shortId(d.siteId)}
                    </p>
                    <p
                      className="truncate font-mono text-[11px]"
                      style={{ color: WALL.muted }}
                    >
                      Guard {shortId(d.guardId)} · since {formatDate(d.startDate)}
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/30">
                    ACTIVE
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Branches table */}
        <section
          className="overflow-hidden rounded-xl shadow-md"
          style={{
            background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
            border: `1px solid ${WALL.borderStrong}`,
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            style={{ borderBottom: `1px solid ${WALL.border}` }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  stats.openAlerts > 0
                    ? 'animate-pulse bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: WALL.muted }}
              >
                Branches · {branches.length}
              </p>
            </div>
            <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
              HIGHLINK · BRANCH OPS
            </p>
          </div>
          <div className="bg-white">
            <DataTable
              loading={loading}
              keyField="id"
              rows={branches}
              emptyMessage={
                error
                  ? 'Branches unavailable — see error above'
                  : 'No branches registered'
              }
              columns={[
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (r) => (
                    <StatusBadge status={r.isActive ? 'ACTIVE' : 'DRAFT'} />
                  ),
                },
              ]}
            />
          </div>
        </section>

        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
          Deferred (honest): Live SSE, GPS map, stall sensors, equipment
          inspection photos, vendor field board. Branch petty cash issue stays
          Finance. Parking permits/billing stay parking-web. No fake coverage %
          or risk scores.
        </p>
      </BranchShell>
    </div>
  );
}
