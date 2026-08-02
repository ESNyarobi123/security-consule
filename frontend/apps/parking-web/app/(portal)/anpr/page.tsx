'use client';

import {
  decideAnpr,
  listAnprResults,
  listVehicles,
  type AnprResult,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  Camera,
  Check,
  LayoutGrid,
  List,
  MapPin,
  RefreshCw,
  ScanLine,
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

type DecisionFilter = 'ALL' | 'PENDING' | 'ALLOW' | 'DENY';
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

function confidenceLabel(c?: number | null): string {
  if (c == null || Number.isNaN(c)) return '—';
  const pct = c <= 1 ? Math.round(c * 100) : Math.round(c);
  return `${pct}%`;
}

function confidenceTone(c?: number | null): string {
  if (c == null) return 'bg-slate-100 text-slate-600';
  const pct = c <= 1 ? c * 100 : c;
  if (pct >= 90) return 'bg-emerald-50 text-emerald-800';
  if (pct >= 75) return 'bg-amber-50 text-amber-800';
  return 'bg-rose-50 text-rose-800';
}

function decisionTone(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'DENY':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-900 ring-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function sortPendingFirst(rows: AnprResult[]): AnprResult[] {
  return [...rows].sort((a, b) => {
    const ad = a.decision ?? 'PENDING';
    const bd = b.decision ?? 'PENDING';
    const ap = ad === 'PENDING' ? 0 : 1;
    const bp = bd === 'PENDING' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
  });
}

export default function AnprPage() {
  const [results, setResults] = useState<AnprResult[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, v] = await Promise.all([listAnprResults(), listVehicles()]);
      setResults(sortPendingFirst(r));
      setVehicles(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ANPR');
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
    return results.map((r) => {
      const veh = vehicleByPlate.get(r.plateNumber.toUpperCase());
      const kind = normalizeVehicleType(veh?.vehicleType);
      const decision = r.decision ?? 'PENDING';
      return {
        ...r,
        decision,
        site: r.siteName || r.siteCode || 'Site',
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
      };
    });
  }, [results, vehicleByPlate]);

  const counts = useMemo(() => {
    const c = { ALL: enriched.length, PENDING: 0, ALLOW: 0, DENY: 0 };
    for (const r of enriched) {
      if (r.decision === 'PENDING') c.PENDING += 1;
      else if (r.decision === 'ALLOW') c.ALLOW += 1;
      else if (r.decision === 'DENY') c.DENY += 1;
    }
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (decisionFilter !== 'ALL' && r.decision !== decisionFilter) return false;
      if (typeFilter !== 'ALL' && r.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        r.plateNumber.toLowerCase().includes(q) ||
        r.site.toLowerCase().includes(q) ||
        (r.cameraId ?? '').toLowerCase().includes(q) ||
        (r.denyReason ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, decisionFilter, typeFilter, search]);

  async function onDecide(id: string, decision: 'ALLOW' | 'DENY') {
    setBusyId(id);
    setError(null);
    try {
      await decideAnpr(id, {
        decision,
        denyReason: decision === 'DENY' ? denyReason || undefined : undefined,
      });
      if (decision === 'DENY') setDenyReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            ANPR decide
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Plate metadata only — Allow / Deny at the gate. No video in Nest.
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
            Captures
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            Pending decide
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">{counts.PENDING}</p>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          Default deny reason
          <span className="ml-1 font-normal text-slate-400">(used on Deny)</span>
        </label>
        <input
          type="text"
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          placeholder="e.g. no permit / blacklisted / wrong zone"
          className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, site, camera…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All', counts.ALL],
              ['PENDING', 'Pending', counts.PENDING],
              ['ALLOW', 'Allow', counts.ALLOW],
              ['DENY', 'Deny', counts.DENY],
            ] as const
          ).map(([id, label, n]) => (
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
                      : id === 'PENDING'
                        ? 'bg-amber-500 text-white'
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
        <p className="py-12 text-center text-sm text-slate-500">Loading ANPR…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <ScanLine className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-base font-semibold text-slate-700">No captures match</p>
          <p className="mt-1 text-sm text-slate-500">
            Pending plates appear here for officer decide.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const meta = VEHICLE_META[r.kind];
            const pending = r.decision === 'PENDING';
            return (
              <article
                key={r.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                  pending ? 'ring-2 ring-amber-300/60' : ''
                }`}
                style={{ borderColor: pending ? '#fcd34d' : `${meta.accent}40` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: pending
                      ? 'linear-gradient(135deg, #fffbeb 0%, #ffffff 70%)'
                      : `linear-gradient(135deg, ${meta.soft} 0%, #ffffff 75%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"
                    style={{ boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={r.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(r.decision)}`}
                      >
                        {r.decision}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${confidenceTone(r.confidence)}`}
                      >
                        {confidenceLabel(r.confidence)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {r.plateNumber}
                    </p>
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: meta.accent }}
                    >
                      {meta.label}
                      {r.makeModel ? ` · ${r.makeModel}` : ' · unknown fleet'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">{r.site}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Camera className="h-3.5 w-3.5" />
                    <span className="font-semibold">{r.cameraId || 'Camera'}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {formatWhen(r.capturedAt)}
                  </p>
                  {r.denyReason ? (
                    <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-800">
                      Reason · {r.denyReason}
                    </p>
                  ) : null}
                </div>

                {pending ? (
                  <div className="flex gap-2 border-t border-amber-100 bg-amber-50/40 px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void onDecide(r.id, 'ALLOW')}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {busyId === r.id ? '…' : 'Allow'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void onDecide(r.id, 'DENY')}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" />
                      Deny
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
                <th className="px-4 py-3">Plate</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Captured</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = VEHICLE_META[r.kind];
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                      r.decision === 'PENDING' ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={r.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {r.plateNumber}
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
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(r.decision)}`}
                      >
                        {r.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${confidenceTone(r.confidence)}`}
                      >
                        {confidenceLabel(r.confidence)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.site}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatWhen(r.capturedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.denyReason || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.decision === 'PENDING' ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onDecide(r.id, 'ALLOW')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                          >
                            Allow
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onDecide(r.id, 'DENY')}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                          >
                            Deny
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
