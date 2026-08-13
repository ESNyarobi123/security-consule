'use client';

import {
  createVehicle,
  listParkingCustomerOptions,
  listVehicles,
  updateVehicle,
  type ParkingCustomerOption,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  LayoutGrid,
  List,
  Nfc,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  PARKING_CATEGORIES,
  PARKING_CATEGORY_META,
  VEHICLE_META,
  VehicleGlyph,
  normalizeParkingCategory,
  normalizeVehicleType,
  type ParkingCategoryKind,
  type VehicleKind,
} from '../_components/parking-ui';

type ViewMode = 'cards' | 'table';
type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ModalMode = 'create' | 'edit';

const VEHICLE_TYPES = Object.keys(VEHICLE_META) as VehicleKind[];

type VehicleForm = {
  plateNumber: string;
  vehicleType: VehicleKind;
  parkingCategory: ParkingCategoryKind;
  make: string;
  model: string;
  color: string;
  ownerName: string;
  ownerPhone: string;
  driverName: string;
  driverPhone: string;
  rfidTagRef: string;
  customerId: string;
  isActive: boolean;
};

const emptyForm = (): VehicleForm => ({
  plateNumber: '',
  vehicleType: 'CAR',
  parkingCategory: 'COMPANY',
  make: '',
  model: '',
  color: '',
  ownerName: '',
  ownerPhone: '',
  driverName: '',
  driverPhone: '',
  rfidTagRef: '',
  customerId: '',
  isActive: true,
});

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

function formFromVehicle(v: ParkingOpsVehicle): VehicleForm {
  return {
    plateNumber: v.plateNumber,
    vehicleType: normalizeVehicleType(v.vehicleType),
    parkingCategory: normalizeParkingCategory(v.parkingCategory),
    make: v.make ?? '',
    model: v.model ?? '',
    color: v.color ?? '',
    ownerName: v.ownerName ?? '',
    ownerPhone: v.ownerPhone ?? '',
    driverName: v.driverName ?? '',
    driverPhone: v.driverPhone ?? '',
    rfidTagRef: v.rfidTagRef ?? '',
    customerId: v.customerId ?? '',
    isActive: v.isActive,
  };
}

function categoryNeedsCustomer(cat: ParkingCategoryKind): boolean {
  return PARKING_CATEGORY_META[cat].needsCustomer;
}

function categoryFleetOnly(cat: ParkingCategoryKind): boolean {
  return PARKING_CATEGORY_META[cat].fleetOnly;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [customers, setCustomers] = useState<ParkingCustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<
    ParkingCategoryKind | 'ALL'
  >('ALL');
  const [rfidFilter, setRfidFilter] = useState<'ALL' | 'TAGGED' | 'UNTAGGED'>(
    'ALL',
  );
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('ACTIVE');
  const [view, setView] = useState<ViewMode>('cards');

  const [modal, setModal] = useState<ModalMode | null>(null);
  const [editing, setEditing] = useState<ParkingOpsVehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const customerById = useMemo(() => {
    const m = new Map<string, ParkingCustomerOption>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [veh, cust] = await Promise.all([
        listVehicles(),
        listParkingCustomerOptions().catch(() => [] as ParkingCustomerOption[]),
      ]);
      setVehicles(veh);
      setCustomers(cust.filter((c) => c.isActive !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const tagged = vehicles.filter((v) => !!v.rfidTagRef).length;
    const active = vehicles.filter((v) => v.isActive).length;
    return {
      ALL: vehicles.length,
      TAGGED: tagged,
      UNTAGGED: vehicles.length - tagged,
      ACTIVE: active,
      INACTIVE: vehicles.length - active,
    };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const kind = normalizeVehicleType(v.vehicleType);
      const cat = normalizeParkingCategory(v.parkingCategory);
      if (typeFilter !== 'ALL' && kind !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
      if (rfidFilter === 'TAGGED' && !v.rfidTagRef) return false;
      if (rfidFilter === 'UNTAGGED' && v.rfidTagRef) return false;
      if (activeFilter === 'ACTIVE' && !v.isActive) return false;
      if (activeFilter === 'INACTIVE' && v.isActive) return false;
      if (!q) return true;
      const cust = v.customerId ? customerById.get(v.customerId) : null;
      return [
        v.plateNumber,
        v.make,
        v.model,
        v.ownerName,
        v.driverName,
        v.rfidTagRef,
        v.color,
        cat,
        PARKING_CATEGORY_META[cat].label,
        cust?.code,
        cust?.name,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [
    vehicles,
    search,
    typeFilter,
    categoryFilter,
    rfidFilter,
    activeFilter,
    customerById,
  ]);

  function openCreate() {
    setModal('create');
    setEditing(null);
    setForm(emptyForm());
    setModalError(null);
  }

  function openEdit(v: ParkingOpsVehicle) {
    setModal('edit');
    setEditing(v);
    setForm(formFromVehicle(v));
    setModalError(null);
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setModalError(null);
  }

  function setCategory(next: ParkingCategoryKind) {
    setForm((f) => ({
      ...f,
      parkingCategory: next,
      customerId: categoryFleetOnly(next) ? '' : f.customerId,
    }));
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      if (categoryNeedsCustomer(form.parkingCategory) && !form.customerId) {
        setModalError(
          'Customer / customer-employee vehicles require an active customer',
        );
        return;
      }
      if (modal === 'create') {
        const plate = form.plateNumber.trim().toUpperCase();
        if (plate.length < 3) {
          setModalError('Plate number must be at least 3 characters');
          return;
        }
        const rfid = form.rfidTagRef.trim();
        const created = await createVehicle({
          plateNumber: plate,
          vehicleType: form.vehicleType,
          parkingCategory: form.parkingCategory,
          make: form.make.trim() || undefined,
          model: form.model.trim() || undefined,
          color: form.color.trim() || undefined,
          ownerName: form.ownerName.trim() || undefined,
          ownerPhone: form.ownerPhone.trim() || undefined,
          driverName: form.driverName.trim() || undefined,
          driverPhone: form.driverPhone.trim() || undefined,
          rfidTagRef: rfid.length ? rfid : undefined,
          customerId: categoryFleetOnly(form.parkingCategory)
            ? undefined
            : form.customerId || undefined,
        });
        setVehicles((prev) =>
          [...prev, created].sort((a, b) =>
            a.plateNumber.localeCompare(b.plateNumber),
          ),
        );
      } else if (modal === 'edit' && editing) {
        const rfid = form.rfidTagRef.trim();
        const updated = await updateVehicle(editing.id, {
          vehicleType: form.vehicleType,
          parkingCategory: form.parkingCategory,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          color: form.color.trim() || null,
          ownerName: form.ownerName.trim() || null,
          ownerPhone: form.ownerPhone.trim() || null,
          driverName: form.driverName.trim() || null,
          driverPhone: form.driverPhone.trim() || null,
          rfidTagRef: rfid.length ? rfid : null,
          isActive: form.isActive,
        });
        setVehicles((prev) =>
          prev.map((v) => (v.id === updated.id ? updated : v)),
        );
      }
      closeModal();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function quickToggleActive(v: ParkingOpsVehicle) {
    try {
      const updated = await updateVehicle(v.id, { isActive: !v.isActive });
      setVehicles((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access · Module 13-I
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Vehicles
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Register by parking category (customer, employee, visitor, company,
            patrol, supplier, contractor, emergency, temporary). Driver + RFID
            on the same record; permit status stays on Permits.
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#163456]"
          >
            <Plus className="h-4 w-4" />
            Register vehicle
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['ALL', 'All vehicles', counts.ALL, () => setActiveFilter('ALL')],
            [
              'ACTIVE',
              'Active',
              counts.ACTIVE,
              () => setActiveFilter('ACTIVE'),
            ],
            [
              'INACTIVE',
              'Inactive',
              counts.INACTIVE,
              () => setActiveFilter('INACTIVE'),
            ],
            [
              'TAGGED',
              'With RFID',
              counts.TAGGED,
              () => setRfidFilter('TAGGED'),
            ],
          ] as const
        ).map(([key, label, n, onClick]) => {
          const selected =
            key === 'TAGGED'
              ? rfidFilter === 'TAGGED'
              : activeFilter === key ||
                (key === 'ALL' && activeFilter === 'ALL' && rfidFilter === 'ALL');
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === 'TAGGED') {
                  setRfidFilter((prev) =>
                    prev === 'TAGGED' ? 'ALL' : 'TAGGED',
                  );
                  return;
                }
                onClick();
                if (key === 'ALL') setRfidFilter('ALL');
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
            placeholder="Search plate, category, RFID, owner, driver…"
            className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(
              e.target.value as ParkingCategoryKind | 'ALL',
            )
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All categories</option>
          {PARKING_CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {PARKING_CATEGORY_META[k].label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as VehicleKind | 'ALL')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All body types</option>
          {VEHICLE_TYPES.map((k) => (
            <option key={k} value={k}>
              {VEHICLE_META[k].label}
            </option>
          ))}
        </select>
        <select
          value={rfidFilter}
          onChange={(e) =>
            setRfidFilter(e.target.value as 'ALL' | 'TAGGED' | 'UNTAGGED')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">RFID: all</option>
          <option value="TAGGED">RFID: tagged</option>
          <option value="UNTAGGED">RFID: none</option>
        </select>
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`rounded px-2 py-1.5 ${view === 'cards' ? 'bg-slate-100' : ''}`}
            aria-label="Cards"
          >
            <LayoutGrid className="h-4 w-4 text-slate-600" />
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded px-2 py-1.5 ${view === 'table' ? 'bg-slate-100' : ''}`}
            aria-label="Table"
          >
            <List className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading vehicles…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-600">No vehicles match filters.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Register first vehicle
          </button>
        </div>
      ) : view === 'cards' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const kind = normalizeVehicleType(v.vehicleType);
            const cat = normalizeParkingCategory(v.parkingCategory);
            const cust = v.customerId
              ? customerById.get(v.customerId)
              : undefined;
            return (
              <li
                key={v.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  v.isActive
                    ? 'border-slate-200'
                    : 'border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <VehicleGlyph kind={kind} className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {v.plateNumber}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[v.make, v.model, v.color].filter(Boolean).join(' · ') ||
                          VEHICLE_META[kind].label}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      v.isActive
                        ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {v.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {PARKING_CATEGORY_META[cat].label}
                  </span>
                  {v.rfidTagRef ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-teal-200">
                      <Nfc className="h-3 w-3" />
                      {v.rfidTagRef}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      <Tag className="h-3 w-3" />
                      No RFID
                    </span>
                  )}
                  {cust ? (
                    <span className="text-xs text-slate-500">{cust.code}</span>
                  ) : null}
                  {v.driverName ? (
                    <span className="text-xs text-slate-500">
                      Driver: {v.driverName}
                    </span>
                  ) : v.ownerName ? (
                    <span className="text-xs text-slate-500">{v.ownerName}</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void quickToggleActive(v)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {v.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Plate</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Driver / owner</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">RFID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const cat = normalizeParkingCategory(v.parkingCategory);
                const cust = v.customerId
                  ? customerById.get(v.customerId)
                  : undefined;
                return (
                  <tr
                    key={v.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {v.plateNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {PARKING_CATEGORY_META[cat].label}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.vehicleType}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.driverName ?? v.ownerName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {cust ? `${cust.code}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {v.rfidTagRef ? (
                        <span className="font-mono text-xs text-teal-800">
                          {v.rfidTagRef}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          v.isActive ? 'text-teal-700' : 'text-slate-500'
                        }`}
                      >
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        className="text-xs font-medium text-[#0078d4] hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={(e) => void submitForm(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {modal === 'create' ? 'Register vehicle' : 'Edit vehicle'}
                </h2>
                <p className="text-sm text-slate-600">
                  {modal === 'create'
                    ? 'Ops fleet register · Module 13-I'
                    : editing?.plateNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Plate number *
                </span>
                <input
                  value={form.plateNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plateNumber: e.target.value.toUpperCase(),
                    }))
                  }
                  disabled={modal === 'edit'}
                  required
                  minLength={3}
                  placeholder="T123ABC"
                  className={`${fieldCls} font-mono disabled:bg-slate-50`}
                  autoFocus={modal === 'create'}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Parking category *
                </span>
                <select
                  value={form.parkingCategory}
                  onChange={(e) =>
                    setCategory(e.target.value as ParkingCategoryKind)
                  }
                  className={fieldCls}
                >
                  {PARKING_CATEGORIES.map((k) => (
                    <option key={k} value={k}>
                      {PARKING_CATEGORY_META[k].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Body type
                </span>
                <select
                  value={form.vehicleType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      vehicleType: e.target.value as VehicleKind,
                    }))
                  }
                  className={fieldCls}
                >
                  {VEHICLE_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {VEHICLE_META[k].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer
                  {categoryNeedsCustomer(form.parkingCategory) ? ' *' : ''}
                </span>
                <select
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                  disabled={
                    modal === 'edit' || categoryFleetOnly(form.parkingCategory)
                  }
                  required={categoryNeedsCustomer(form.parkingCategory)}
                  className={`${fieldCls} disabled:bg-slate-50`}
                >
                  <option value="">
                    {categoryFleetOnly(form.parkingCategory)
                      ? '— Not linked (fleet) —'
                      : '— Select customer —'}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
                {modal === 'edit' ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Customer link is set at register. Switching to
                    Company/Patrol/Emergency clears it on save.
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Make
                </span>
                <input
                  value={form.make}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, make: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Model
                </span>
                <input
                  value={form.model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, model: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Color
                </span>
                <input
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Owner name
                </span>
                <input
                  value={form.ownerName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerName: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Owner phone
                </span>
                <input
                  value={form.ownerPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerPhone: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Driver name
                </span>
                <input
                  value={form.driverName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driverName: e.target.value }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Driver phone
                </span>
                <input
                  value={form.driverPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driverPhone: e.target.value }))
                  }
                  minLength={7}
                  placeholder="Optional · min 7 chars"
                  className={fieldCls}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  RFID / tag ref
                </span>
                <input
                  value={form.rfidTagRef}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rfidTagRef: e.target.value }))
                  }
                  placeholder="e.g. RFID-DEMO-T123"
                  className={`${fieldCls} font-mono`}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Leave blank to clear on edit. Duplicate tags return 409
                  RFID_TAG_IN_USE.
                </span>
              </label>

              {modal === 'edit' ? (
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              ) : null}
            </div>

            {modalError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {modalError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving
                  ? 'Saving…'
                  : modal === 'create'
                    ? 'Register'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
