'use client';

import {
  listEntries,
  listVehicles,
  type ParkingOpsEntry,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutGrid,
  List,
  MapPin,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type DecisionFilter = 'ALL' | 'ALLOW' | 'DENY' | 'PENDING';
type DirectionFilter = 'ALL' | 'ENTRY' | 'EXIT';
type ViewMode = 'cards' | 'table';

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

function decisionTone(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'DENY':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function directionTone(direction: string): string {
  return direction === 'EXIT'
    ? 'bg-sky-50 text-sky-800'
    : 'bg-teal-50 text-teal-800';
}

export default function EntriesPage() {
  const [entries, setEntries] = useState<ParkingOpsEntry[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('ALL');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, v] = await Promise.all([listEntries(), listVehicles()]);
      setEntries(e);
      setVehicles(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
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
    return entries.map((e) => {
      const veh = vehicleByPlate.get(e.plateNumber.toUpperCase());
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...e,
        site: e.siteName || e.siteCode || 'Site',
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
      };
    });
  }, [entries, vehicleByPlate]);

  const counts = useMemo(() => {
    const c = {
      ALL: enriched.length,
      TODAY: enriched.filter((e) => isToday(e.recordedAt)).length,
      ALLOW: enriched.filter((e) => e.decision === 'ALLOW').length,
      DENY: enriched.filter((e) => e.decision === 'DENY').length,
      ENTRY: enriched.filter((e) => e.direction === 'ENTRY').length,
      EXIT: enriched.filter((e) => e.direction === 'EXIT').length,
    };
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((e) => {
      if (decisionFilter !== 'ALL' && e.decision !== decisionFilter) return false;
      if (directionFilter !== 'ALL' && e.direction !== directionFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && e.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        e.plateNumber.toLowerCase().includes(q) ||
        e.site.toLowerCase().includes(q) ||
        e.decision.toLowerCase().includes(q) ||
        e.direction.toLowerCase().includes(q) ||
        (e.owner ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, decisionFilter, directionFilter, typeFilter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Gate entries
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live in/out log — ALLOW / DENY decisions at the gate.
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
            Total logs
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700/80">
            Today
          </p>
          <p className="mt-1 text-3xl font-bold text-teal-800">{counts.TODAY}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
            Allowed
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">{counts.ALLOW}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80">
            Denied
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-800">{counts.DENY}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, site, decision…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All'],
              ['ALLOW', 'Allow'],
              ['DENY', 'Deny'],
              ['PENDING', 'Pending'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDecisionFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                decisionFilter === id
                  ? id === 'DENY'
                    ? 'bg-rose-600 text-white'
                    : id === 'ALLOW'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              {id !== 'ALL' && id !== 'PENDING' ? (
                <span className="ml-1 opacity-80">
                  ({id === 'ALLOW' ? counts.ALLOW : counts.DENY})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'Both'],
              ['ENTRY', 'Entry'],
              ['EXIT', 'Exit'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDirectionFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                directionFilter === id
                  ? 'bg-[#0d9488] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
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
        <p className="py-12 text-center text-sm text-slate-500">Loading entries…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-700">No entries match</p>
          <p className="mt-1 text-sm text-slate-500">
            Gate logs appear after ANPR decide or manual entry.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => {
            const meta = VEHICLE_META[e.kind];
            const DirIcon =
              e.direction === 'EXIT' ? ArrowUpFromLine : ArrowDownToLine;
            return (
              <article
                key={e.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: `${meta.accent}40` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${meta.soft} 0%, #ffffff 75%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"
                    style={{ boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={e.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(e.decision)}`}
                      >
                        {e.decision}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${directionTone(e.direction)}`}
                      >
                        <DirIcon className="h-3 w-3" />
                        {e.direction}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {e.plateNumber}
                    </p>
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: meta.accent }}
                    >
                      {meta.label}
                      {e.makeModel ? ` · ${e.makeModel}` : ''}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 px-4 py-3">
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">{e.site}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {formatWhen(e.recordedAt)}
                  </p>
                  {e.owner ? (
                    <p className="text-xs text-slate-400">Owner · {e.owner}</p>
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
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = VEHICLE_META[e.kind];
                return (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={e.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {e.plateNumber}
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
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${directionTone(e.direction)}`}
                      >
                        {e.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(e.decision)}`}
                      >
                        {e.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{e.site}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatWhen(e.recordedAt)}
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
