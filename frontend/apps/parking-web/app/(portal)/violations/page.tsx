'use client';

import {
  listVehicles,
  listViolations,
  type ParkingOpsVehicle,
  type ParkingOpsViolation,
} from '@pssms/api-client';
import {
  AlertTriangle,
  LayoutGrid,
  List,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type TypeFilter =
  | 'ALL'
  | 'NO_PERMIT'
  | 'EXPIRED_PERMIT'
  | 'WRONG_ZONE'
  | 'OVERSTAY'
  | 'BLACKLISTED';
type ViewMode = 'cards' | 'table';

const TYPE_META: Record<
  Exclude<TypeFilter, 'ALL'>,
  { label: string; accent: string; soft: string }
> = {
  NO_PERMIT: { label: 'No permit', accent: '#e11d48', soft: '#ffe4e6' },
  EXPIRED_PERMIT: { label: 'Expired', accent: '#d97706', soft: '#fef3c7' },
  WRONG_ZONE: { label: 'Wrong zone', accent: '#7c3aed', soft: '#ede9fe' },
  OVERSTAY: { label: 'Overstay', accent: '#ea580c', soft: '#ffedd5' },
  BLACKLISTED: { label: 'Blacklisted', accent: '#0f172a', soft: '#e2e8f0' },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function typeLabel(t: string): string {
  return TYPE_META[t as Exclude<TypeFilter, 'ALL'>]?.label ?? t.replace(/_/g, ' ');
}

function typeTone(t: string): { accent: string; soft: string } {
  return (
    TYPE_META[t as Exclude<TypeFilter, 'ALL'>] ?? {
      accent: '#64748b',
      soft: '#f1f5f9',
    }
  );
}

export default function ViolationsPage() {
  const [violations, setViolations] = useState<ParkingOpsViolation[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, veh] = await Promise.all([listViolations(), listVehicles()]);
      setViolations(v);
      setVehicles(veh);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load violations',
      );
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
    return violations.map((v) => {
      const veh = vehicleByPlate.get(v.plateNumber.toUpperCase());
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...v,
        site: v.siteName || v.siteCode || 'Site',
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
      };
    });
  }, [violations, vehicleByPlate]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      ALL: enriched.length,
      TODAY: enriched.filter((v) => isToday(v.recordedAt)).length,
      NO_PERMIT: 0,
      EXPIRED_PERMIT: 0,
      WRONG_ZONE: 0,
      OVERSTAY: 0,
      BLACKLISTED: 0,
    };
    for (const v of enriched) {
      c[v.violationType] = (c[v.violationType] ?? 0) + 1;
    }
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((v) => {
      if (typeFilter !== 'ALL' && v.violationType !== typeFilter) return false;
      if (vehicleFilter !== 'ALL' && v.kind !== vehicleFilter) return false;
      if (!q) return true;
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        v.site.toLowerCase().includes(q) ||
        v.violationType.toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q) ||
        (v.owner ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, typeFilter, vehicleFilter, search]);

  const typeChips: { id: TypeFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'NO_PERMIT', label: 'No permit' },
    { id: 'EXPIRED_PERMIT', label: 'Expired' },
    { id: 'WRONG_ZONE', label: 'Wrong zone' },
    { id: 'OVERSTAY', label: 'Overstay' },
    { id: 'BLACKLISTED', label: 'Blacklisted' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Violations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enforcement log — no permit, blacklist, zone and overstay.
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80">
            Today
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-800">{counts.TODAY}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            No permit
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">
            {counts.NO_PERMIT ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Blacklisted
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {counts.BLACKLISTED ?? 0}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, site, type, description…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {typeChips.map((c) => {
            const active = typeFilter === c.id;
            const tone =
              c.id === 'ALL' ? null : typeTone(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setTypeFilter(c.id)}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition"
                style={
                  active && tone
                    ? { background: tone.accent, color: '#fff' }
                    : active
                      ? { background: '#e11d48', color: '#fff' }
                      : {
                          background: tone?.soft ?? '#f1f5f9',
                          color: tone?.accent ?? '#475569',
                        }
                }
              >
                {c.label}
                <span className="ml-1 opacity-80">({counts[c.id] ?? 0})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'] as const).map((t) => {
            const active = vehicleFilter === t;
            const meta = t === 'ALL' ? null : VEHICLE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setVehicleFilter(t)}
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
          Loading violations…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-base font-semibold text-slate-700">
            No violations match
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Deny decisions and blacklist hits create records here.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const meta = VEHICLE_META[v.kind];
            const vt = typeTone(v.violationType);
            return (
              <article
                key={v.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: `${vt.accent}55` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${vt.soft} 0%, #ffffff 70%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"
                    style={{ boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={v.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                        style={{ background: vt.accent }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {typeLabel(v.violationType)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {v.plateNumber}
                    </p>
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: meta.accent }}
                    >
                      {meta.label}
                      {v.makeModel ? ` · ${v.makeModel}` : ''}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    {v.description || 'No description'}
                  </p>
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">{v.site}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {formatWhen(v.recordedAt)}
                  </p>
                  {v.owner ? (
                    <p className="text-xs text-slate-400">Owner · {v.owner}</p>
                  ) : null}
                </div>
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
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const meta = VEHICLE_META[v.kind];
                const vt = typeTone(v.violationType);
                return (
                  <tr
                    key={v.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={v.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {v.plateNumber}
                          </p>
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: meta.accent }}
                          >
                            {meta.label}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                        style={{ background: vt.accent }}
                      >
                        {typeLabel(v.violationType)}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                      {v.description || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {v.site}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatWhen(v.recordedAt)}
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
