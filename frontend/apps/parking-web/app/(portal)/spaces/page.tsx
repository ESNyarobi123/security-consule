'use client';

import {
  allocateParkingSpace,
  createParkingSpace,
  listParkingCustomerOptions,
  listParkingSiteOptions,
  listParkingSpaces,
  listVehicles,
  releaseParkingSpace,
  updateParkingSpace,
  type ParkingCustomerOption,
  type ParkingSiteOption,
  type ParkingOpsSpace,
  type ParkingOpsVehicle,
  type ParkingSpaceType,
  type ParkingAllocationMode,
  type ParkingSpaceStatus,
} from '@pssms/api-client';
import {
  MapPinned,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const SPACE_TYPES: { id: ParkingSpaceType; label: string }[] = [
  { id: 'EMPLOYEE', label: 'Employee' },
  { id: 'VISITOR', label: 'Visitor' },
  { id: 'VIP', label: 'VIP' },
  { id: 'CONTRACTOR', label: 'Contractor' },
  { id: 'SUPPLIER', label: 'Supplier' },
  { id: 'FLEET', label: 'Fleet' },
  { id: 'RESERVED', label: 'Reserved' },
  { id: 'DISABLED', label: 'Disabled' },
  { id: 'TEMPORARY', label: 'Temporary' },
  { id: 'OVERFLOW', label: 'Overflow' },
];

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

type ModalMode = 'create' | 'allocate' | null;

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<ParkingOpsSpace[]>([]);
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [customers, setCustomers] = useState<ParkingCustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<ParkingSpaceType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    ParkingSpaceStatus | 'ALL'
  >('ALL');

  const [modal, setModal] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    siteId: '',
    code: '',
    spaceType: 'EMPLOYEE' as ParkingSpaceType,
    allocationMode: 'MANUAL' as ParkingAllocationMode,
    customerId: '',
    label: '',
    notes: '',
  });

  const [allocForm, setAllocForm] = useState({
    mode: 'MANUAL' as ParkingAllocationMode,
    siteId: '',
    vehicleId: '',
    spaceId: '',
    spaceType: '' as ParkingSpaceType | '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sp, st, veh, cust] = await Promise.all([
        listParkingSpaces(),
        listParkingSiteOptions().catch(() => [] as ParkingSiteOption[]),
        listVehicles().catch(() => [] as ParkingOpsVehicle[]),
        listParkingCustomerOptions().catch(
          () => [] as ParkingCustomerOption[],
        ),
      ]);
      setSpaces(sp);
      setSites(st);
      setVehicles(veh.filter((v) => v.isActive));
      setCustomers(cust.filter((c) => c.isActive !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const available = spaces.filter((s) => s.status === 'AVAILABLE').length;
    const occupied = spaces.filter((s) => s.status === 'OCCUPIED').length;
    const auto = spaces.filter((s) => s.allocationMode === 'AUTO').length;
    return {
      ALL: spaces.length,
      AVAILABLE: available,
      OCCUPIED: occupied,
      AUTO: auto,
    };
  }, [spaces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spaces.filter((s) => {
      if (siteFilter !== 'ALL' && s.siteId !== siteFilter) return false;
      if (typeFilter !== 'ALL' && s.spaceType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!q) return true;
      return [
        s.code,
        s.label,
        s.spaceType,
        s.plateNumber,
        s.siteCode,
        s.customerCode,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [spaces, search, siteFilter, typeFilter, statusFilter]);

  const availableForManual = useMemo(() => {
    return spaces.filter(
      (s) =>
        s.isActive &&
        s.status === 'AVAILABLE' &&
        (!allocForm.siteId || s.siteId === allocForm.siteId),
    );
  }, [spaces, allocForm.siteId]);

  function openCreate() {
    setModal('create');
    setModalError(null);
    setCreateForm({
      siteId: sites[0]?.id ?? '',
      code: '',
      spaceType: 'EMPLOYEE',
      allocationMode: 'MANUAL',
      customerId: '',
      label: '',
      notes: '',
    });
  }

  function openAllocate() {
    setModal('allocate');
    setModalError(null);
    setAllocForm({
      mode: 'MANUAL',
      siteId: sites[0]?.id ?? '',
      vehicleId: vehicles[0]?.id ?? '',
      spaceId: '',
      spaceType: '',
    });
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      const created = await createParkingSpace({
        siteId: createForm.siteId,
        code: createForm.code.trim().toUpperCase(),
        spaceType: createForm.spaceType,
        allocationMode: createForm.allocationMode,
        customerId: createForm.customerId || undefined,
        label: createForm.label.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
      });
      setSpaces((prev) =>
        [...prev, created].sort((a, b) => a.code.localeCompare(b.code)),
      );
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function submitAllocate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      if (allocForm.mode === 'MANUAL' && !allocForm.spaceId) {
        setModalError('Select a space for manual allocation');
        return;
      }
      const updated = await allocateParkingSpace({
        mode: allocForm.mode,
        siteId: allocForm.siteId,
        vehicleId: allocForm.vehicleId,
        spaceId:
          allocForm.mode === 'MANUAL' ? allocForm.spaceId : undefined,
        spaceType:
          allocForm.mode === 'AUTO' && allocForm.spaceType
            ? allocForm.spaceType
            : undefined,
      });
      setSpaces((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Allocate failed');
    } finally {
      setSaving(false);
    }
  }

  async function onRelease(s: ParkingOpsSpace) {
    try {
      const updated = await releaseParkingSpace(s.id);
      setSpaces((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    }
  }

  async function toggleOutOfService(s: ParkingOpsSpace) {
    try {
      const next: ParkingSpaceStatus =
        s.status === 'OUT_OF_SERVICE' ? 'AVAILABLE' : 'OUT_OF_SERVICE';
      const updated = await updateParkingSpace(s.id, { status: next });
      setSpaces((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  function typeLabel(t: string) {
    return SPACE_TYPES.find((x) => x.id === t)?.label ?? t;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access · Module 13-J
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Parking spaces
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Register bays by type (employee, visitor, VIP, contractor, supplier,
            fleet, reserved, disabled, temporary, overflow). Allocate manually
            or AUTO (AUTO-eligible bays + vehicle category policy).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAllocate}
            className="inline-flex items-center gap-2 rounded-md border border-teal-600 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-100"
          >
            <Sparkles className="h-4 w-4" />
            Allocate
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#163456]"
          >
            <Plus className="h-4 w-4" />
            Add space
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['ALL', 'All bays', counts.ALL],
            ['AVAILABLE', 'Available', counts.AVAILABLE],
            ['OCCUPIED', 'Occupied', counts.OCCUPIED],
            ['AUTO', 'AUTO-eligible', counts.AUTO],
          ] as const
        ).map(([key, label, n]) => {
          const selected =
            key === 'AUTO'
              ? false
              : statusFilter === key ||
                (key === 'ALL' && statusFilter === 'ALL');
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === 'AUTO') {
                  setStatusFilter('ALL');
                  return;
                }
                setStatusFilter(
                  key === 'ALL' ? 'ALL' : (key as ParkingSpaceStatus),
                );
              }}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                selected
                  ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{n}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, plate, site…"
            className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as ParkingSpaceType | 'ALL')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All types</option>
          {SPACE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ParkingSpaceStatus | 'ALL')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
          <option value="OUT_OF_SERVICE">Out of service</option>
        </select>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading spaces…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <MapPinned className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">No spaces match filters.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add first space
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{s.code}</p>
                    {s.label ? (
                      <p className="text-xs text-slate-500">{s.label}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {typeLabel(String(s.spaceType))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.siteCode ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        s.allocationMode === 'AUTO'
                          ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.allocationMode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        s.status === 'AVAILABLE'
                          ? 'text-teal-700'
                          : s.status === 'OCCUPIED'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {s.plateNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {s.status === 'OCCUPIED' ? (
                        <button
                          type="button"
                          onClick={() => void onRelease(s)}
                          className="text-xs font-medium text-[#0078d4] hover:underline"
                        >
                          Release
                        </button>
                      ) : s.status !== 'OCCUPIED' ? (
                        <button
                          type="button"
                          onClick={() => void toggleOutOfService(s)}
                          className="text-xs font-medium text-slate-600 hover:underline"
                        >
                          {s.status === 'OUT_OF_SERVICE'
                            ? 'Back to available'
                            : 'Out of service'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'create' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={(e) => void submitCreate(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add parking space
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Site *
                </span>
                <select
                  required
                  value={createForm.siteId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, siteId: e.target.value }))
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
                  Code *
                </span>
                <input
                  required
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="A-12"
                  className={`${fieldCls} font-mono`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Type *
                </span>
                <select
                  value={createForm.spaceType}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      spaceType: e.target.value as ParkingSpaceType,
                    }))
                  }
                  className={fieldCls}
                >
                  {SPACE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Allocation mode
                </span>
                <select
                  value={createForm.allocationMode}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      allocationMode: e.target.value as ParkingAllocationMode,
                    }))
                  }
                  className={fieldCls}
                >
                  <option value="MANUAL">Manual only</option>
                  <option value="AUTO">AUTO-eligible</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer (optional)
                </span>
                <select
                  value={createForm.customerId}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      customerId: e.target.value,
                    }))
                  }
                  className={fieldCls}
                >
                  <option value="">— Shared / site default —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Label
                </span>
                <input
                  value={createForm.label}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, label: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
            </div>
            {modalError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {modalError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {modal === 'allocate' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={(e) => void submitAllocate(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Allocate space
                </h2>
                <p className="text-sm text-slate-600">
                  Manual pick or AUTO from eligible bays (customer-dedicated
                  first, then shared, then overflow).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Mode *
                </span>
                <select
                  value={allocForm.mode}
                  onChange={(e) =>
                    setAllocForm((f) => ({
                      ...f,
                      mode: e.target.value as ParkingAllocationMode,
                    }))
                  }
                  className={fieldCls}
                >
                  <option value="MANUAL">Manual</option>
                  <option value="AUTO">Automatic</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Site *
                </span>
                <select
                  required
                  value={allocForm.siteId}
                  onChange={(e) =>
                    setAllocForm((f) => ({
                      ...f,
                      siteId: e.target.value,
                      spaceId: '',
                    }))
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
                  Vehicle *
                </span>
                <select
                  required
                  value={allocForm.vehicleId}
                  onChange={(e) =>
                    setAllocForm((f) => ({ ...f, vehicleId: e.target.value }))
                  }
                  className={fieldCls}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber}
                      {v.parkingCategory ? ` · ${v.parkingCategory}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {allocForm.mode === 'MANUAL' ? (
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Space *
                  </span>
                  <select
                    required
                    value={allocForm.spaceId}
                    onChange={(e) =>
                      setAllocForm((f) => ({ ...f, spaceId: e.target.value }))
                    }
                    className={fieldCls}
                  >
                    <option value="">— Select available bay —</option>
                    {availableForManual.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {typeLabel(String(s.spaceType))} ·{' '}
                        {s.allocationMode}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Preferred type (optional)
                  </span>
                  <select
                    value={allocForm.spaceType}
                    onChange={(e) =>
                      setAllocForm((f) => ({
                        ...f,
                        spaceType: e.target.value as ParkingSpaceType | '',
                      }))
                    }
                    className={fieldCls}
                  >
                    <option value="">— Infer from vehicle category —</option>
                    {SPACE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {modalError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {modalError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Allocating…' : 'Allocate'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
