'use client';

import {
  createParkingPatrolObservation,
  listParkingPatrolGuardOptions,
  listParkingPatrolObservations,
  listParkingSiteOptions,
  type ParkingOpsPatrolObservation,
  type ParkingPatrolGuardOption,
  type ParkingPatrolObservationType,
  type ParkingSiteOption,
} from '@pssms/api-client';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

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

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

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

  const [showForm, setShowForm] = useState(false);
  const [guardOptions, setGuardOptions] = useState<ParkingPatrolGuardOption[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{
    siteId: string;
    guardId: string;
    parkingArea: string;
    observationType: ParkingPatrolObservationType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    plateNumber: string;
    notes: string;
  }>({
    siteId: '',
    guardId: '',
    parkingArea: '',
    observationType: 'IRREGULARITY' as ParkingPatrolObservationType,
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    plateNumber: '',
    notes: '',
  });

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
      setForm((f) => ({
        ...f,
        siteId: f.siteId || (siteOpts[0]?.id ?? ''),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load patrols');
    } finally {
      setLoading(false);
    }
  }, [siteFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.siteId) return;
    let alive = true;
    void listParkingPatrolGuardOptions(form.siteId)
      .then((opts) => {
        if (!alive) return;
        setGuardOptions(opts);
        setForm((f) => ({
          ...f,
          guardId: opts.some((g) => g.id === f.guardId)
            ? f.guardId
            : (opts[0]?.id ?? ''),
        }));
      })
      .catch(() => {
        if (alive) setGuardOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [form.siteId]);

  async function submitObservation(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      if (!form.siteId) {
        setFormError('Select a site');
        return;
      }
      if (!form.guardId) {
        setFormError(
          'Select the guard on duty — observations must be attributed to a guard',
        );
        return;
      }
      if (!form.parkingArea.trim()) {
        setFormError('Parking area is required (e.g. Lot A · visitor bay)');
        return;
      }
      const created = await createParkingPatrolObservation({
        siteId: form.siteId,
        guardId: form.guardId,
        parkingArea: form.parkingArea.trim(),
        observationType: form.observationType,
        severity: form.severity,
        plateNumber: form.plateNumber.trim().toUpperCase() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setRows((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setNotice('Observation recorded.');
      setForm((f) => ({
        ...f,
        parkingArea: '',
        plateNumber: '',
        notes: '',
      }));
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to record observation',
      );
    } finally {
      setSaving(false);
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Close form' : 'Record observation'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void submitObservation(e)}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">
            New parking patrol observation
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Attributed to the guard on duty. HIGH severity (accident, suspicious,
            abandoned) raises a FieldAlert automatically.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Site *
              </span>
              <select
                required
                value={form.siteId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, siteId: e.target.value, guardId: '' }))
                }
                className={fieldCls}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Guard on duty *
              </span>
              <select
                required
                value={form.guardId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, guardId: e.target.value }))
                }
                className={fieldCls}
              >
                <option value="">— Select guard —</option>
                {guardOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.employeeNumber}
                    {g.fullName ? ` · ${g.fullName}` : ''}
                  </option>
                ))}
              </select>
              {guardOptions.length === 0 ? (
                <span className="mt-1 block text-xs text-amber-700">
                  No active guard deployed at this site.
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Area / zone *
              </span>
              <input
                required
                value={form.parkingArea}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parkingArea: e.target.value }))
                }
                placeholder="Lot A · visitor bay"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Observation *
              </span>
              <select
                value={form.observationType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    observationType: e.target.value as ParkingPatrolObservationType,
                  }))
                }
                className={fieldCls}
              >
                {OBS_TYPES.filter((t) => t.id !== 'ALL').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Severity
              </span>
              <select
                value={form.severity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    severity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH',
                  }))
                }
                className={fieldCls}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Plate (optional)
              </span>
              <input
                value={form.plateNumber}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    plateNumber: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="T123ABC"
                className={`${fieldCls} font-mono`}
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                placeholder="What did you observe?"
                className={fieldCls}
              />
            </label>
          </div>
          {formError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0f2744] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save observation'}
            </button>
          </div>
        </form>
      ) : null}

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
