'use client';

import {
  listParkingPatrolObservations,
  listParkingSiteOptions,
  type ParkingOpsPatrolObservation,
  type ParkingPatrolObservationType,
  type ParkingSiteOption,
} from '@pssms/api-client';
import {
  ClipboardList,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const OBS_TYPES: { id: ParkingPatrolObservationType | 'ALL'; label: string }[] =
  [
    { id: 'ALL', label: 'All types' },
    { id: 'IRREGULARITY', label: 'Irregularity' },
    { id: 'SECURITY_OBSERVATION', label: 'Security' },
    { id: 'ACCIDENT', label: 'Accident' },
    { id: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious' },
    { id: 'DAMAGE', label: 'Damage' },
    { id: 'ILLEGAL_PARKING', label: 'Illegal parking' },
    { id: 'ABANDONED_VEHICLE', label: 'Abandoned' },
    { id: 'OTHER', label: 'Other' },
  ];

const SEV_TONE: Record<string, { accent: string; soft: string }> = {
  HIGH: { accent: '#e11d48', soft: '#ffe4e6' },
  MEDIUM: { accent: '#d97706', soft: '#fef3c7' },
  LOW: { accent: '#0f766e', soft: '#ccfbf1' },
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

function typeLabel(t: string): string {
  return (
    OBS_TYPES.find((o) => o.id === t)?.label ?? t.replace(/_/g, ' ')
  );
}

export default function PatrolsPage() {
  const [rows, setRows] = useState<ParkingOpsPatrolObservation[]>([]);
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<
    ParkingPatrolObservationType | 'ALL'
  >('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obs, siteOpts] = await Promise.all([
        listParkingPatrolObservations({
          siteId: siteFilter === 'ALL' ? undefined : siteFilter,
          observationType: typeFilter === 'ALL' ? undefined : typeFilter,
        }),
        listParkingSiteOptions(),
      ]);
      setRows(obs);
      setSites(siteOpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patrols');
    } finally {
      setLoading(false);
    }
  }, [siteFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.parkingArea,
        r.plateNumber,
        r.notes,
        r.guardEmployeeNumber,
        r.siteCode,
        r.observationType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Module 13-M · Guard mobile
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Parking patrols
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Inspections recorded by guards: area, irregularities, accidents,
            suspicious activity, damage, illegal parking, abandoned vehicles.
            High-severity types raise a FieldAlert.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search area, plate, notes…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as ParkingPatrolObservationType | 'ALL')
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {OBS_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            No parking patrol observations
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Guards submit via Guard Mobile → Parking patrol.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => {
            const tone = SEV_TONE[r.severity] ?? SEV_TONE.MEDIUM!;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatWhen(r.inspectedAt)}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">
                      {r.parkingArea}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {r.siteCode ?? '—'} · Guard{' '}
                      {r.guardEmployeeNumber ?? r.guardId.slice(0, 8)}
                    </p>
                  </div>
                  <span
                    className="rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ background: tone.soft, color: tone.accent }}
                  >
                    {r.severity}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                    {typeLabel(r.observationType)}
                  </span>
                  {r.plateNumber ? (
                    <span className="rounded-md bg-teal-50 px-2 py-1 font-mono font-medium text-teal-800">
                      {r.plateNumber}
                    </span>
                  ) : null}
                  {r.parkingSpaceCode ? (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                      Bay {r.parkingSpaceCode}
                    </span>
                  ) : null}
                  {r.fieldAlertId ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700">
                      <ShieldAlert className="h-3 w-3" />
                      FieldAlert
                    </span>
                  ) : null}
                </div>
                {r.notes ? (
                  <p className="mt-3 text-sm text-slate-700 line-clamp-3">
                    {r.notes}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
