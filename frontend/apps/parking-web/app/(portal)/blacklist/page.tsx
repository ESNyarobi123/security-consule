'use client';

import {
  addBlacklist,
  deactivateBlacklist,
  listBlacklist,
  listVehicles,
  type ParkingBlacklistEntry,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  Ban,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldOff,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ViewMode = 'cards' | 'table';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BlacklistPage() {
  const [entries, setEntries] = useState<ParkingBlacklistEntry[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [showForm, setShowForm] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, veh] = await Promise.all([listBlacklist(), listVehicles()]);
      setEntries(
        [...list].sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }),
      );
      setVehicles(veh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blacklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vehicleByPlate = useMemo(() => {
    const m = new Map<string, ParkingOpsVehicle>();
    for (const v of vehicles) m.set(v.plateNumber.toUpperCase(), v);
    return m;
  }, [vehicles]);

  const enriched = useMemo(() => {
    return entries.map((b) => {
      const veh = vehicleByPlate.get(b.plateNumber.toUpperCase());
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...b,
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
        known: !!veh,
      };
    });
  }, [entries, vehicleByPlate]);

  const counts = useMemo(() => {
    const active = enriched.filter((b) => b.isActive).length;
    return {
      ALL: enriched.length,
      ACTIVE: active,
      INACTIVE: enriched.length - active,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((b) => {
      if (statusFilter === 'ACTIVE' && !b.isActive) return false;
      if (statusFilter === 'INACTIVE' && b.isActive) return false;
      if (typeFilter !== 'ALL' && b.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        b.plateNumber.toLowerCase().includes(q) ||
        b.reason.toLowerCase().includes(q) ||
        (b.owner ?? '').toLowerCase().includes(q) ||
        (b.makeModel ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, statusFilter, typeFilter, search]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addBlacklist({
        plateNumber: plateNumber.trim().toUpperCase(),
        reason: reason.trim(),
      });
      setPlateNumber('');
      setReason('');
      setStatusFilter('ACTIVE');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deactivateBlacklist(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Blacklist
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Blocked plates — gate entry and ANPR deny enforcement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0f172a] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {showForm ? 'Hide form' : 'Add plate'}
          </button>
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
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total plates
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80">
            Active blocks
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-800">{counts.ACTIVE}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Inactive
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-700">{counts.INACTIVE}</p>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={onAdd}
          className="rounded-2xl border border-slate-800/10 bg-gradient-to-br from-slate-900 to-[#1e293b] p-5 text-white shadow-lg"
        >
          <div className="mb-3 flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-rose-300" />
            <h2 className="font-display text-base font-bold">Add to blacklist</h2>
          </div>
          <p className="mb-4 text-xs text-slate-300">
            Active plates are denied at manual gate entry. Plate is stored
            uppercase.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Plate
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="T123ABC"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-mono font-bold uppercase text-white outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30"
                required
                minLength={3}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Reason
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Security hold / unpaid fines / fraud…"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30"
                required
                minLength={3}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-400 disabled:opacity-60 sm:min-w-[120px]"
              >
                <Ban className="h-4 w-4" />
                {saving ? 'Adding…' : 'Block'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, reason, owner…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All', counts.ALL],
              ['ACTIVE', 'Active', counts.ACTIVE],
              ['INACTIVE', 'Inactive', counts.INACTIVE],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === id
                  ? id === 'ACTIVE'
                    ? 'bg-rose-600 text-white'
                    : id === 'INACTIVE'
                      ? 'bg-slate-600 text-white'
                      : 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              <span className="ml-1 opacity-80">({n})</span>
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
                    ? { background: meta.accent, color: '#fff' }
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
        <p className="py-12 text-center text-sm text-slate-500">
          Loading blacklist…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <ShieldBan className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-base font-semibold text-slate-700">
            No blacklist entries match
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Add a plate above to block gate entry.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const meta = VEHICLE_META[b.kind];
            return (
              <article
                key={b.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                  b.isActive
                    ? 'border-rose-200 ring-1 ring-rose-100'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: b.isActive
                      ? 'linear-gradient(135deg, #ffe4e6 0%, #ffffff 70%)'
                      : 'linear-gradient(135deg, #f1f5f9 0%, #ffffff 70%)',
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"
                    style={{
                      boxShadow: `0 0 0 1px ${b.isActive ? '#e11d4833' : '#94a3b833'}`,
                    }}
                  >
                    {b.known ? (
                      <VehicleGlyph kind={b.kind} className="h-9 w-9" />
                    ) : (
                      <Ban className="h-7 w-7 text-rose-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          b.isActive
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {b.known ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: meta.soft, color: meta.accent }}
                        >
                          {meta.label}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          Unknown fleet
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {b.plateNumber}
                    </p>
                    {b.makeModel || b.owner ? (
                      <p className="truncate text-xs text-slate-500">
                        {[b.makeModel, b.owner].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                  <p className="text-sm font-medium text-slate-800">{b.reason}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    Added {formatWhen(b.createdAt)}
                  </p>
                </div>

                {b.isActive ? (
                  <div className="border-t border-rose-100 px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void onDeactivate(b.id)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      {busyId === b.id ? '…' : 'Deactivate'}
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="text-center text-[11px] font-semibold text-slate-400">
                      Re-add with same plate to reactivate
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Plate</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const meta = VEHICLE_META[b.kind];
                return (
                  <tr
                    key={b.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                      b.isActive ? '' : 'opacity-70'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{
                            background: b.isActive ? '#ffe4e6' : meta.soft,
                          }}
                        >
                          {b.known ? (
                            <VehicleGlyph kind={b.kind} className="h-6 w-6" />
                          ) : (
                            <Ban className="h-4 w-4 text-rose-500" />
                          )}
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {b.plateNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {b.known ? meta.label : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                      {b.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          b.isActive
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatWhen(b.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {b.isActive ? (
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => void onDeactivate(b.id)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
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
