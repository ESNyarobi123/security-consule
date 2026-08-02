'use client';

import {
  approvePermit,
  listPermits,
  listVehicles,
  rejectPermit,
  type ParkingOpsPermit,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  Check,
  LayoutGrid,
  List,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED';
type ViewMode = 'cards' | 'table';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusTone(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'REVOKED':
    case 'EXPIRED':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'SUSPENDED':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function typeTone(type: string): string {
  switch (type) {
    case 'EMPLOYEE':
      return 'bg-blue-50 text-blue-800';
    case 'VISITOR':
      return 'bg-sky-50 text-sky-800';
    case 'CONTRACTOR':
      return 'bg-orange-50 text-orange-800';
    case 'RESERVED':
      return 'bg-violet-50 text-violet-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<ParkingOpsPermit[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, v] = await Promise.all([listPermits(), listVehicles()]);
      setPermits(p);
      setVehicles(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permits');
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

  const enriched = useMemo(() => {
    return permits.map((p) => {
      const veh = vehicleById.get(p.vehicleId);
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...p,
        plate: p.plateNumber || veh?.plateNumber || '—',
        site: p.siteName || p.siteCode || 'Site',
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
      };
    });
  }, [permits, vehicleById]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      ALL: enriched.length,
      PENDING: 0,
      ACTIVE: 0,
      REVOKED: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
    };
    for (const p of enriched) {
      c[p.status] = (c[p.status] ?? 0) + 1;
    }
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && p.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.plate.toLowerCase().includes(q) ||
        p.site.toLowerCase().includes(q) ||
        p.permitType.toLowerCase().includes(q) ||
        (p.owner ?? '').toLowerCase().includes(q) ||
        (p.makeModel ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, statusFilter, typeFilter, search]);

  async function onApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await approvePermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await rejectPermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  }

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'REVOKED', label: 'Revoked' },
    { id: 'EXPIRED', label: 'Expired' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Permits
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review authorizations — approve pending (creator ≠ approver).
          </p>
        </div>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            Pending approval
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">
            {counts.PENDING ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
            Active
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">
            {counts.ACTIVE ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Showing
          </p>
          <p className="mt-1 text-3xl font-bold text-[#2563eb]">
            {filtered.length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, permit #, site, owner…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusChips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setStatusFilter(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === c.id
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
              <span className="ml-1 opacity-80">({counts[c.id] ?? 0})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'] as const).map((t) => {
            const active = typeFilter === t;
            const meta = t === 'ALL' ? null : VEHICLE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition"
                style={
                  active && meta
                    ? {
                        background: meta.accent,
                        color: '#fff',
                      }
                    : active
                      ? { background: '#0f172a', color: '#fff' }
                      : {
                          background: meta?.soft ?? '#f1f5f9',
                          color: meta?.accent ?? '#475569',
                        }
                }
              >
                {t === 'ALL' ? 'All types' : meta!.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex rounded-xl border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'cards'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'table'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading permits…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-700">No permits match</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing filters or search.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const meta = VEHICLE_META[p.kind];
            const pending = p.status === 'PENDING';
            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: `${meta.accent}40` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${meta.soft} 0%, #ffffff 70%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: '#fff', boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={p.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusTone(p.status)}`}
                      >
                        {p.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeTone(p.permitType)}`}
                      >
                        {p.permitType}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {p.plate}
                    </p>
                    <p className="truncate text-xs font-semibold" style={{ color: meta.accent }}>
                      {meta.label}
                      {p.makeModel ? ` · ${p.makeModel}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-bold text-slate-500">
                      {p.permitNumber}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">{p.site}</span>
                  </div>
                  {p.owner ? (
                    <p className="text-xs text-slate-500">Owner · {p.owner}</p>
                  ) : null}
                  <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-slate-400">
                        From
                      </p>
                      <p className="font-bold text-slate-800">{formatDate(p.validFrom)}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wider text-slate-400">
                        Until
                      </p>
                      <p className="font-bold text-slate-800">{formatDate(p.validUntil)}</p>
                    </div>
                  </div>
                </div>

                {pending ? (
                  <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void onApprove(p.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {busyId === p.id ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void onReject(p.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Permit</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Valid</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const meta = VEHICLE_META[p.kind];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={p.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">{p.plate}</p>
                          <p className="text-[11px] font-semibold" style={{ color: meta.accent }}>
                            {meta.label}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      {p.permitNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeTone(p.permitType)}`}
                      >
                        {p.permitType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusTone(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{p.site}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(p.validFrom)} → {formatDate(p.validUntil)}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'PENDING' ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => void onApprove(p.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => void onReject(p.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
