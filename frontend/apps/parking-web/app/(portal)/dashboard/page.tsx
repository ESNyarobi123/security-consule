'use client';

import {
  getParkingReport,
  listAnprResults,
  listBlacklist,
  listEntries,
  listPermits,
  listSites,
  listVehicles,
  listViolations,
  type AnprResult,
  type ParkingOpsEntry,
  type ParkingOpsPermit,
  type ParkingOpsReport,
  type ParkingOpsVehicle,
  type ParkingOpsViolation,
  type Site,
} from '@pssms/api-client';
import { getParkingToken } from '@pssms/auth';
import {
  Activity,
  AlertTriangle,
  Clock3,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KpiCard,
  MiniBar,
  Panel,
  VEHICLE_META,
  VehicleGlyph,
  VehicleTypeCard,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [permits, setPermits] = useState<ParkingOpsPermit[]>([]);
  const [entries, setEntries] = useState<ParkingOpsEntry[]>([]);
  const [violations, setViolations] = useState<ParkingOpsViolation[]>([]);
  const [anpr, setAnpr] = useState<AnprResult[]>([]);
  const [blacklist, setBlacklist] = useState(0);
  const [sites, setSites] = useState<Site[]>([]);
  const [report, setReport] = useState<ParkingOpsReport | null>(null);
  const [siteId, setSiteId] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getParkingToken() ?? undefined;
      const [v, p, e, viols, a, bl, s, r] = await Promise.all([
        listVehicles(),
        listPermits(),
        listEntries(),
        listViolations(),
        listAnprResults(),
        listBlacklist(),
        listSites(token).catch(() => [] as Site[]),
        getParkingReport().catch(() => null),
      ]);
      setVehicles(v);
      setPermits(p);
      setEntries(e);
      setViolations(viols);
      setAnpr(a);
      setBlacklist(bl.filter((b) => b.isActive).length);
      setSites(s);
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, ParkingOpsVehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const siteLabel = useCallback(
    (id: string) => {
      const fromApi = sites.find((s) => s.id === id);
      if (fromApi) return fromApi.name;
      const fromPermit = permits.find((p) => p.siteId === id);
      return fromPermit?.siteName || fromPermit?.siteCode || id.slice(0, 8);
    },
    [sites, permits],
  );

  const siteTabs = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sites) ids.add(s.id);
    for (const p of permits) ids.add(p.siteId);
    const list = [...ids].map((id) => ({
      id,
      label: siteLabel(id),
      activePermits: permits.filter(
        (p) => p.siteId === id && p.status === 'ACTIVE',
      ).length,
    }));
    list.sort((a, b) => b.activePermits - a.activePermits || a.label.localeCompare(b.label));
    return list;
  }, [sites, permits, siteLabel]);

  const typeCounts = useMemo(() => {
    const counts: Record<VehicleKind, number> = {
      CAR: 0,
      MOTORCYCLE: 0,
      TRUCK: 0,
      BUS: 0,
      OTHER: 0,
    };
    for (const v of vehicles) {
      if (!v.isActive) continue;
      counts[normalizeVehicleType(v.vehicleType)] += 1;
    }
    return counts;
  }, [vehicles]);

  const activePermits = permits.filter((p) => p.status === 'ACTIVE').length;
  const pendingPermits = permits.filter((p) => p.status === 'PENDING').length;
  const pendingAnpr = anpr.filter(
    (r) => (r.decision ?? 'PENDING') === 'PENDING',
  ).length;
  const entriesToday = entries.filter((e) => isToday(e.recordedAt)).length;
  const allowAnpr = anpr.filter((r) => r.decision === 'ALLOW').length;
  const denyAnpr = anpr.filter((r) => r.decision === 'DENY').length;

  const permitStatusMax = Math.max(
    activePermits,
    pendingPermits,
    permits.filter((p) => p.status === 'REVOKED' || p.status === 'EXPIRED').length,
    1,
  );

  const sitePermits = useMemo(() => {
    return permits.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (siteId !== 'ALL' && p.siteId !== siteId) return false;
      if (typeFilter === 'ALL') return true;
      const veh = vehicleById.get(p.vehicleId);
      return normalizeVehicleType(veh?.vehicleType) === typeFilter;
    });
  }, [permits, siteId, typeFilter, vehicleById]);

  const mostUsedSite = siteTabs[0];
  const recentPendingAnpr = anpr
    .filter((r) => (r.decision ?? 'PENDING') === 'PENDING')
    .slice(0, 5);
  const recentEntries = [...entries]
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, 5);
  const recentViolations = [...violations]
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          label="Active permits"
          value={loading ? '—' : activePermits}
          href="/permits"
          tone="blue"
          hint={pendingPermits ? `${pendingPermits} pending` : 'Authorized now'}
        />
        <KpiCard
          label="Pending ANPR"
          value={loading ? '—' : pendingAnpr}
          href="/anpr"
          tone="amber"
          hint="Awaiting decide"
        />
        <KpiCard
          label="Violations"
          value={loading ? '—' : violations.length}
          href="/violations"
          tone="rose"
        />
        <KpiCard
          label="Entries today"
          value={loading ? '—' : entriesToday}
          href="/entries"
          tone="teal"
        />
        <KpiCard
          label="Fleet vehicles"
          value={loading ? '—' : vehicles.filter((v) => v.isActive).length}
          tone="slate"
          hint="Registered active"
        />
        <KpiCard
          label="Utilization"
          value={
            loading ? '—' : `${report?.occupancy.utilizationPercent ?? 0}%`
          }
          href="/reports"
          tone="teal"
          hint={
            report
              ? `${report.occupancy.occupied}/${report.occupancy.totalSpaces} bays`
              : 'Bay occupancy'
          }
        />
        <KpiCard
          label="Open visits"
          value={loading ? '—' : report?.entriesExits.openVisits ?? 0}
          href="/entries"
          tone="amber"
          hint="ENTRY without EXIT"
        />
        <KpiCard
          label="Revenue (30d)"
          value={
            loading
              ? '—'
              : report
                ? new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: report.revenue.currency,
                    maximumFractionDigits: 0,
                  }).format(report.revenue.totalBilledInPeriod)
                : '—'
          }
          href="/reports"
          tone="blue"
          hint="Billed invoices"
        />
        <KpiCard
          label="Blacklist"
          value={loading ? '—' : blacklist}
          href="/blacklist"
          tone="rose"
          hint="Active plates"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Site permit map (real permits — not sensor bays) */}
        <Panel
          className="xl:col-span-2"
          title={
            siteId === 'ALL'
              ? 'Site permit layout'
              : `${siteLabel(siteId)} · active permits`
          }
          action={
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {sitePermits.length} shown
            </span>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSiteId('ALL')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                siteId === 'ALL'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All sites
            </button>
            {siteTabs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSiteId(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  siteId === s.id
                    ? 'bg-[#0d9488] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
                <span className="ml-1 opacity-80">({s.activePermits})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading layout…</p>
          ) : sitePermits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <MapPin className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">
                No active permits for this filter
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Bay sensor maps are not wired yet — this grid shows real ACTIVE
                permits by site & vehicle type.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {sitePermits.map((p) => {
                const veh = vehicleById.get(p.vehicleId);
                const kind = normalizeVehicleType(veh?.vehicleType);
                const meta = VEHICLE_META[kind];
                const plate = p.plateNumber || veh?.plateNumber || '—';
                return (
                  <div
                    key={p.id}
                    className="group relative flex flex-col items-center rounded-xl border px-2 py-3 shadow-sm transition hover:shadow-md"
                    style={{
                      background: `linear-gradient(180deg, ${meta.soft} 0%, #ffffff 70%)`,
                      borderColor: `${meta.accent}55`,
                    }}
                    title={`${plate} · ${p.permitNumber} · ${meta.label}`}
                  >
                    <span
                      className="mb-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: meta.soft, color: meta.accent }}
                    >
                      {meta.label}
                    </span>
                    <VehicleGlyph kind={kind} className="h-9 w-9" />
                    <p className="mt-1.5 w-full truncate text-center font-mono text-[11px] font-bold text-slate-900">
                      {plate}
                    </p>
                    <p
                      className="w-full truncate text-center text-[10px] font-semibold"
                      style={{ color: meta.accent }}
                    >
                      {p.permitType}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Each tile = one ACTIVE permit (authorized vehicle for the site). Not
            a live stall sensor map.
          </p>
        </Panel>

        {/* Right analysis column */}
        <div className="space-y-5">
          <Panel title="Ops overview">
            <div className="mb-4 flex h-28 items-end gap-1.5">
              {[
                activePermits,
                pendingAnpr,
                entriesToday,
                violations.length,
                blacklist,
                allowAnpr,
              ].map((v, i) => {
                const max = Math.max(
                  activePermits,
                  pendingAnpr,
                  entriesToday,
                  violations.length,
                  blacklist,
                  allowAnpr,
                  1,
                );
                const h = Math.max(12, Math.round((v / max) * 100));
                const colors = [
                  '#2563eb',
                  '#f59e0b',
                  '#0d9488',
                  '#e11d48',
                  '#64748b',
                  '#38bdf8',
                ];
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md transition-all duration-500"
                    style={{ height: `${h}%`, background: colors[i] }}
                    title={String(v)}
                  />
                );
              })}
            </div>
            <div className="space-y-3">
              <MiniBar
                label="Active permits"
                value={activePermits}
                max={permitStatusMax}
                color="#2563eb"
              />
              <MiniBar
                label="Pending permits"
                value={pendingPermits}
                max={permitStatusMax}
                color="#f59e0b"
              />
              <MiniBar
                label="ANPR allow / deny"
                value={allowAnpr}
                max={Math.max(allowAnpr + denyAnpr, 1)}
                color="#0d9488"
              />
            </div>
            {mostUsedSite ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
                <MapPin className="mt-0.5 h-4 w-4 text-[#0d9488]" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {mostUsedSite.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    Most permits · {mostUsedSite.activePermits} active
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
              <Clock3 className="mt-0.5 h-4 w-4 text-[#2563eb]" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {entriesToday} entries today
                </p>
                <p className="text-xs text-slate-500">Gate in/out recorded</p>
              </div>
            </div>
          </Panel>

          <Panel title="Fleet by type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
              {(['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'] as VehicleKind[]).map(
                (kind) => (
                  <VehicleTypeCard
                    key={kind}
                    kind={kind}
                    count={typeCounts[kind]}
                    active={typeFilter === kind}
                    onClick={() =>
                      setTypeFilter((prev) => (prev === kind ? 'ALL' : kind))
                    }
                  />
                ),
              )}
            </div>
            {typeFilter !== 'ALL' ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-[#2563eb] hover:underline"
                onClick={() => setTypeFilter('ALL')}
              >
                Clear vehicle filter
              </button>
            ) : (
              <p className="mt-3 text-[11px] text-slate-400">
                Tap a type to filter the site permit layout.
              </p>
            )}
          </Panel>
        </div>
      </div>

      {/* Activity row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="ANPR queue"
          action={
            <Link
              href="/anpr"
              className="text-xs font-semibold text-[#2563eb] hover:underline"
            >
              Open board
            </Link>
          }
        >
          {recentPendingAnpr.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <ScanLine className="h-4 w-4" /> No pending captures
            </p>
          ) : (
            <ul className="space-y-2">
              {recentPendingAnpr.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-amber-50/80 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {r.plateNumber}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatWhen(r.capturedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent entries"
          action={
            <Link
              href="/entries"
              className="text-xs font-semibold text-[#2563eb] hover:underline"
            >
              View all
            </Link>
          }
        >
          {recentEntries.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="h-4 w-4" /> No entries yet
            </p>
          ) : (
            <ul className="space-y-2">
              {recentEntries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {e.plateNumber}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {e.direction} · {formatWhen(e.recordedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      e.decision === 'ALLOW'
                        ? 'bg-teal-100 text-teal-800'
                        : e.decision === 'DENY'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {e.decision}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Violations"
          action={
            <Link
              href="/violations"
              className="text-xs font-semibold text-[#2563eb] hover:underline"
            >
              View all
            </Link>
          }
        >
          {recentViolations.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldAlert className="h-4 w-4" /> No violations
            </p>
          ) : (
            <ul className="space-y-2">
              {recentViolations.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start gap-2 rounded-xl bg-rose-50/70 px-3 py-2"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {v.plateNumber}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {v.violationType.replace(/_/g, ' ')} ·{' '}
                      {formatWhen(v.recordedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Executive summary via{' '}
        <Link href="/reports" className="font-semibold text-[#2563eb] hover:underline">
          Reports
        </Link>
        · Deferred: live stall sensors, zone bay maps, RFID barriers. ANPR =
        metadata decide only.
      </p>
    </div>
  );
}
