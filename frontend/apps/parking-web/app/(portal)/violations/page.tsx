'use client';

import {
  createParkingViolation,
  listParkingSiteOptions,
  listVehicles,
  listViolations,
  type ParkingOpsVehicle,
  type ParkingOpsViolation,
  type ParkingSiteOption,
  type ParkingViolationType,
} from '@pssms/api-client';
import {
  AlertTriangle,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ViolationManageModal } from '../_components/violation-manage-modal';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type TypeFilter = 'ALL' | ParkingViolationType;
type StatusFilter =
  | 'ALL'
  | 'OPEN'
  | 'CORRECTIVE_ACTION'
  | 'PENDING_CLOSURE'
  | 'CLOSED';
type ViewMode = 'cards' | 'table';

const VIOLATION_TYPES: ParkingViolationType[] = [
  'UNAUTHORIZED',
  'RESTRICTED_AREA',
  'EMERGENCY_ROUTE_BLOCKED',
  'EXPIRED_PERMIT',
  'DOUBLE_PARKING',
  'ABANDONED_VEHICLE',
  'UNSAFE_PARKING',
  'NO_PERMIT',
  'WRONG_ZONE',
  'OVERSTAY',
  'BLACKLISTED',
];

const TYPE_META: Record<
  ParkingViolationType,
  { label: string; accent: string; soft: string }
> = {
  UNAUTHORIZED: { label: 'Unauthorized', accent: '#e11d48', soft: '#ffe4e6' },
  RESTRICTED_AREA: { label: 'Restricted area', accent: '#7c3aed', soft: '#ede9fe' },
  EMERGENCY_ROUTE_BLOCKED: {
    label: 'Emergency route',
    accent: '#dc2626',
    soft: '#fee2e2',
  },
  EXPIRED_PERMIT: { label: 'Expired auth', accent: '#d97706', soft: '#fef3c7' },
  DOUBLE_PARKING: { label: 'Double parking', accent: '#ea580c', soft: '#ffedd5' },
  ABANDONED_VEHICLE: { label: 'Abandoned', accent: '#475569', soft: '#e2e8f0' },
  UNSAFE_PARKING: { label: 'Unsafe', accent: '#b45309', soft: '#fef3c7' },
  NO_PERMIT: { label: 'No permit', accent: '#e11d48', soft: '#ffe4e6' },
  WRONG_ZONE: { label: 'Wrong zone', accent: '#7c3aed', soft: '#ede9fe' },
  OVERSTAY: { label: 'Overstay', accent: '#ea580c', soft: '#ffedd5' },
  BLACKLISTED: { label: 'Blacklisted', accent: '#0f172a', soft: '#e2e8f0' },
};

function isClosedStatus(status: string): boolean {
  return status === 'CLOSED' || status === 'RESOLVED';
}

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';

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
  return TYPE_META[t as ParkingViolationType]?.label ?? t.replace(/_/g, ' ');
}

function typeTone(t: string): { accent: string; soft: string } {
  return (
    TYPE_META[t as ParkingViolationType] ?? {
      accent: '#64748b',
      soft: '#f1f5f9',
    }
  );
}

export default function ViolationsPage() {
  const [violations, setViolations] = useState<ParkingOpsViolation[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const [showForm, setShowForm] = useState(true);
  const [siteId, setSiteId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [violationType, setViolationType] =
    useState<ParkingViolationType>('UNAUTHORIZED');
  const [description, setDescription] = useState('');
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [manageTarget, setManageTarget] =
    useState<ParkingOpsViolation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, veh, s] = await Promise.all([
        listViolations(),
        listVehicles(),
        listParkingSiteOptions().catch(() => [] as ParkingSiteOption[]),
      ]);
      setViolations(v);
      setVehicles(veh.filter((x) => x.isActive));
      setSites(s);
      setSiteId((prev) =>
        prev && s.some((x) => x.id === prev) ? prev : (s[0]?.id ?? ''),
      );
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
        status: v.status || 'OPEN',
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
      OPEN: enriched.filter((v) => v.status === 'OPEN').length,
      CORRECTIVE_ACTION: enriched.filter(
        (v) => v.status === 'CORRECTIVE_ACTION',
      ).length,
      PENDING_CLOSURE: enriched.filter(
        (v) => v.status === 'PENDING_CLOSURE',
      ).length,
      CLOSED: enriched.filter((v) => isClosedStatus(v.status)).length,
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
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CLOSED') {
          if (!isClosedStatus(v.status)) return false;
        } else if (v.status !== statusFilter) return false;
      }
      if (typeFilter !== 'ALL' && v.violationType !== typeFilter) return false;
      if (vehicleFilter !== 'ALL' && v.kind !== vehicleFilter) return false;
      if (!q) return true;
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        v.site.toLowerCase().includes(q) ||
        v.violationType.toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q) ||
        (v.resolutionNotes ?? '').toLowerCase().includes(q) ||
        (v.owner ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, typeFilter, vehicleFilter, statusFilter, search]);

  function onVehiclePick(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setPlateNumber(v.plateNumber);
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (!siteId) {
        setFormError('Select a site');
        return;
      }
      const plate = plateNumber.trim().toUpperCase();
      if (plate.length < 3) {
        setFormError('Plate must be at least 3 characters');
        return;
      }
      const fine = fineAmount.trim() ? Number(fineAmount) : undefined;
      const discount = discountAmount.trim()
        ? Number(discountAmount)
        : undefined;
      if (fine != null && (Number.isNaN(fine) || fine < 0)) {
        setFormError('Fine must be a non-negative number');
        return;
      }
      if (discount != null && (Number.isNaN(discount) || discount < 0)) {
        setFormError('Discount must be a non-negative number');
        return;
      }
      const created = await createParkingViolation({
        siteId,
        plateNumber: plate,
        vehicleId: vehicleId || undefined,
        violationType,
        description: description.trim() || undefined,
        officerRemarks: officerRemarks.trim() || undefined,
        fineAmount: fine,
        discountAmount: discount,
        currency: fine != null ? 'TZS' : undefined,
      });
      setViolations((prev) => [created, ...prev]);
      setPlateNumber('');
      setVehicleId('');
      setDescription('');
      setOfficerRemarks('');
      setFineAmount('');
      setDiscountAmount('');
      setViolationType('UNAUTHORIZED');
      setStatusFilter('OPEN');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  const typeChips: { id: TypeFilter; label: string }[] = [
    { id: 'ALL', label: 'All types' },
    ...VIOLATION_TYPES.map((t) => ({ id: t as TypeFilter, label: typeLabel(t) })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Enforcement · Module 13-N/P
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Violations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record with officer remarks, photos, and optional fines; bill to
            finance invoice; corrective → closure (creator ≠ approver).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Hide form' : 'Record violation'}
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

      {showForm ? (
        <form
          onSubmit={(ev) => void submitCreate(ev)}
          className="rounded-2xl border border-rose-900/40 bg-[#1c1917] p-5 text-white shadow-lg"
        >
          <h2 className="text-lg font-semibold">Record violation</h2>
          <p className="mt-1 text-xs text-stone-400">
            Workflow: OPEN → corrective action → submit → approve &amp; close.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Site *
              </span>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                required
                className={fieldCls}
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Type *
              </span>
              <select
                value={violationType}
                onChange={(e) =>
                  setViolationType(e.target.value as ParkingViolationType)
                }
                className={fieldCls}
              >
                {VIOLATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Known vehicle
              </span>
              <select
                value={vehicleId}
                onChange={(e) => onVehiclePick(e.target.value)}
                className={fieldCls}
              >
                <option value="">— Type plate —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Plate *
              </span>
              <input
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                required
                minLength={3}
                placeholder="T123ABC"
                className={`${fieldCls} font-mono`}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Officer remarks
              </span>
              <input
                value={officerRemarks}
                onChange={(e) => setOfficerRemarks(e.target.value)}
                placeholder="Gate officer observations…"
                className={fieldCls}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Description
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened…"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Fine (TZS)
              </span>
              <input
                type="number"
                min={0}
                step="1000"
                value={fineAmount}
                onChange={(e) => setFineAmount(e.target.value)}
                placeholder="Optional"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Discount
              </span>
              <input
                type="number"
                min={0}
                step="1000"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
                className={fieldCls}
              />
            </label>
          </div>
          {formError ? (
            <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !sites.length}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              <AlertTriangle className="h-4 w-4" />
              {saving ? 'Saving…' : 'Record violation'}
            </button>
          </div>
        </form>
      ) : null}

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
        <button
          type="button"
          onClick={() => setStatusFilter('OPEN')}
          className={`rounded-2xl border p-4 text-left shadow-sm ${
            statusFilter === 'OPEN'
              ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200'
              : 'border-rose-200/80 bg-rose-50/40'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80">
            Open
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-800">{counts.OPEN}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING_CLOSURE')}
          className={`rounded-2xl border p-4 text-left shadow-sm ${
            statusFilter === 'PENDING_CLOSURE'
              ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
              : 'border-amber-200/80 bg-amber-50/40'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            Pending approval
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">
            {counts.PENDING_CLOSURE}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('CLOSED')}
          className={`rounded-2xl border p-4 text-left shadow-sm ${
            statusFilter === 'CLOSED'
              ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
              : 'border-emerald-200/80 bg-emerald-50/40'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
            Closed
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">
            {counts.CLOSED}
          </p>
        </button>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
            Today
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-800">{counts.TODAY}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, site, type, notes…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All status'],
              ['OPEN', 'Open'],
              ['CORRECTIVE_ACTION', 'Action'],
              ['PENDING_CLOSURE', 'Pending'],
              ['CLOSED', 'Closed'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === id
                  ? id === 'CLOSED'
                    ? 'bg-emerald-600 text-white'
                    : id === 'OPEN'
                      ? 'bg-rose-600 text-white'
                      : id === 'PENDING_CLOSURE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {typeChips.map((c) => {
            const active = typeFilter === c.id;
            const tone = c.id === 'ALL' ? null : typeTone(c.id);
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
            Record manually or wait for gate/ANPR auto-denies.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const meta = VEHICLE_META[v.kind];
            const vt = typeTone(v.violationType);
            const closed = isClosedStatus(v.status);
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          closed
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                        }`}
                      >
                        {v.status}
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
                  {v.officerRemarks ? (
                    <p className="text-xs text-slate-600">
                      Officer · {v.officerRemarks}
                    </p>
                  ) : null}
                  {v.netFineAmount != null && v.netFineAmount > 0 ? (
                    <p className="text-xs font-semibold text-slate-800">
                      Fine ·{' '}
                      {new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: v.currency || 'TZS',
                        maximumFractionDigits: 0,
                      }).format(v.netFineAmount)}
                      {v.invoiceStatus ? (
                        <span className="ml-1.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-800 ring-1 ring-teal-200">
                          {v.invoiceStatus}
                          {v.balanceDue != null && v.balanceDue > 0
                            ? ` · due ${v.balanceDue}`
                            : ''}
                        </span>
                      ) : (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700">
                          Unbilled
                        </span>
                      )}
                    </p>
                  ) : null}
                  {v.closureNotes || v.resolutionNotes ? (
                    <p className="text-xs text-emerald-700">
                      Closure · {v.closureNotes ?? v.resolutionNotes}
                    </p>
                  ) : null}
                  {!closed ? (
                    <button
                      type="button"
                      onClick={() => setManageTarget(v)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Manage
                    </button>
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Recorded</th>
                <th className="px-4 py-3" />
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
                        <p className="font-mono font-bold text-slate-900">
                          {v.plateNumber}
                        </p>
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
                    <td className="px-4 py-3 text-xs font-semibold">
                      {v.status}
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
                    <td className="px-4 py-3 text-right">
                      {!isClosedStatus(v.status) ? (
                        <button
                          type="button"
                          onClick={() => setManageTarget(v)}
                          className="text-xs font-medium text-slate-700 hover:underline"
                        >
                          Manage
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {manageTarget ? (
        <ViolationManageModal
          violation={manageTarget}
          onClose={() => setManageTarget(null)}
          onUpdated={(updated) => {
            setViolations((prev) =>
              prev.map((v) => (v.id === updated.id ? updated : v)),
            );
            setManageTarget(updated);
          }}
        />
      ) : null}
    </div>
  );
}
