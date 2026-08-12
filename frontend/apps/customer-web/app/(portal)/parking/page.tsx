'use client';

import {
  createCustomerParkingVehicle,
  getCustomerPortalSites,
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  requestCustomerParkingPermit,
  updateCustomerParkingVehicle,
  type ParkingPermit,
  type ParkingVehicle,
  type PortalSite,
} from '@pssms/api-client';
import { Car, Pencil, Plus, RefreshCw, Ticket, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'TRUCK', 'BUS', 'OTHER'] as const;
const PERMIT_TYPES = ['EMPLOYEE', 'VISITOR', 'CONTRACTOR', 'RESERVED'] as const;

type VehicleForm = {
  plateNumber: string;
  vehicleType: (typeof VEHICLE_TYPES)[number];
  make: string;
  model: string;
  color: string;
  ownerName: string;
  ownerPhone: string;
};

const emptyForm = (): VehicleForm => ({
  plateNumber: '',
  vehicleType: 'CAR',
  make: '',
  model: '',
  color: '',
  ownerName: '',
  ownerPhone: '',
});

const inputCls =
  'mt-1 w-full rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20';

export default function ParkingPage() {
  const [vehicles, setVehicles] = useState<ParkingVehicle[]>([]);
  const [permits, setPermits] = useState<ParkingPermit[]>([]);
  const [sites, setSites] = useState<PortalSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'vehicles' | 'permits'>('vehicles');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [modal, setModal] = useState<'add' | 'edit' | 'permit' | null>(null);
  const [editing, setEditing] = useState<ParkingVehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [permitForm, setPermitForm] = useState({
    vehicleId: '',
    siteId: '',
    permitType: 'EMPLOYEE' as (typeof PERMIT_TYPES)[number],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, p, s] = await Promise.all([
        listCustomerParkingVehicles(),
        listCustomerParkingPermits(),
        getCustomerPortalSites(),
      ]);
      setVehicles(v);
      setPermits(p);
      setSites(s.filter((x) => x.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parking');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeVehicles = vehicles.filter((v) => v.isActive).length;
  const activePermits = permits.filter((p) =>
    p.status.toUpperCase().includes('ACTIVE'),
  ).length;

  const vehicleById = useMemo(() => {
    const m = new Map<string, ParkingVehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const filters =
    tab === 'vehicles'
      ? [
          { id: 'ALL', label: 'All', count: vehicles.length },
          {
            id: 'ACTIVE',
            label: 'Active',
            count: activeVehicles,
          },
          {
            id: 'INACTIVE',
            label: 'Inactive',
            count: vehicles.length - activeVehicles,
          },
        ]
      : [
          { id: 'ALL', label: 'All', count: permits.length },
          ...[...new Set(permits.map((p) => p.status.toUpperCase()))].map(
            (s) => ({
              id: s,
              label: s.replace(/_/g, ' '),
              count: permits.filter((p) => p.status.toUpperCase() === s).length,
            }),
          ),
        ];

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter === 'ACTIVE' && !v.isActive) return false;
      if (statusFilter === 'INACTIVE' && v.isActive) return false;
      if (!q) return true;
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        (v.make ?? '').toLowerCase().includes(q) ||
        (v.model ?? '').toLowerCase().includes(q) ||
        (v.ownerName ?? '').toLowerCase().includes(q) ||
        v.vehicleType.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter]);

  const filteredPermits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permits.filter((p) => {
      if (statusFilter !== 'ALL' && p.status.toUpperCase() !== statusFilter) {
        return false;
      }
      const plate =
        p.plateNumber ?? vehicleById.get(p.vehicleId)?.plateNumber ?? '';
      if (!q) return true;
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.permitType.toLowerCase().includes(q) ||
        plate.toLowerCase().includes(q) ||
        (p.siteCode ?? '').toLowerCase().includes(q) ||
        (p.siteName ?? '').toLowerCase().includes(q)
      );
    });
  }, [permits, search, statusFilter, vehicleById]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModal('add');
  }

  function openEdit(v: ParkingVehicle) {
    setEditing(v);
    setForm({
      plateNumber: v.plateNumber,
      vehicleType: (VEHICLE_TYPES.includes(
        v.vehicleType as (typeof VEHICLE_TYPES)[number],
      )
        ? v.vehicleType
        : 'CAR') as VehicleForm['vehicleType'],
      make: v.make ?? '',
      model: v.model ?? '',
      color: v.color ?? '',
      ownerName: v.ownerName ?? '',
      ownerPhone: '',
    });
    setFormError(null);
    setModal('edit');
  }

  function openPermitRequest(preselectVehicleId?: string) {
    const active = vehicles.filter((v) => v.isActive);
    const vehicleId =
      preselectVehicleId && active.some((v) => v.id === preselectVehicleId)
        ? preselectVehicleId
        : (active[0]?.id ?? '');
    setPermitForm({
      vehicleId,
      siteId: sites[0]?.id ?? '',
      permitType: 'EMPLOYEE',
    });
    setFormError(null);
    setTab('permits');
    setModal('permit');
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (modal === 'add') {
        const plate = form.plateNumber.trim().toUpperCase();
        if (plate.length < 3) {
          setFormError('Plate number must be at least 3 characters');
          return;
        }
        await createCustomerParkingVehicle({
          plateNumber: plate,
          vehicleType: form.vehicleType,
          make: form.make.trim() || undefined,
          model: form.model.trim() || undefined,
          color: form.color.trim() || undefined,
          ownerName: form.ownerName.trim() || undefined,
          ownerPhone: form.ownerPhone.trim() || undefined,
        });
      } else if (modal === 'edit' && editing) {
        await updateCustomerParkingVehicle(editing.id, {
          vehicleType: form.vehicleType,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          color: form.color.trim() || null,
          ownerName: form.ownerName.trim() || null,
          ownerPhone: form.ownerPhone.trim() || null,
        });
      } else if (modal === 'permit') {
        if (!permitForm.vehicleId || !permitForm.siteId) {
          setFormError('Select an active vehicle and site');
          return;
        }
        await requestCustomerParkingPermit({
          vehicleId: permitForm.vehicleId,
          siteId: permitForm.siteId,
          permitType: permitForm.permitType,
        });
      }
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(v: ParkingVehicle) {
    const next = !v.isActive;
    const label = next ? 'reactivate' : 'deactivate';
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${v.plateNumber}?`)) {
      return;
    }
    setBusyId(v.id);
    setError(null);
    try {
      await updateCustomerParkingVehicle(v.id, { isActive: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8 · Module 13-C/D"
        title="Parking"
        subtitle="Register vehicles and request parking permits. HIGHLINK parking ops approve requests before they become active."
        actions={
          <div className="flex flex-wrap gap-2">
            {tab === 'vehicles' ? (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#106ebe]"
              >
                <Plus className="h-4 w-4" />
                Add vehicle
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openPermitRequest()}
                disabled={!vehicles.some((v) => v.isActive) || sites.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Request permit
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat label="Vehicles" value={loading ? '—' : vehicles.length} tone="sky" />
        <PortalStat label="Active vehicles" value={loading ? '—' : activeVehicles} tone="teal" />
        <PortalStat label="Active permits" value={loading ? '—' : activePermits} tone="violet" />
      </div>

      <div className="mb-3 flex gap-1 rounded-xl border border-[#e1dfdd] bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => {
            setTab('vehicles');
            setStatusFilter('ALL');
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            tab === 'vehicles'
              ? 'bg-[#0078d4] text-white'
              : 'text-[#605e5c] hover:bg-[#f3f2f1]'
          }`}
        >
          <Car className="h-3.5 w-3.5" /> Vehicles
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('permits');
            setStatusFilter('ALL');
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            tab === 'permits'
              ? 'bg-[#0078d4] text-white'
              : 'text-[#605e5c] hover:bg-[#f3f2f1]'
          }`}
        >
          <Ticket className="h-3.5 w-3.5" /> Permits
        </button>
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          tab === 'vehicles' ? 'Search plate, make, owner…' : 'Search permit #, plate…'
        }
        filters={filters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {tab === 'vehicles' ? (
        loading && vehicles.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#edebe9]" />
            ))}
          </div>
        ) : filteredVehicles.length === 0 ? (
          <PortalEmpty
            title="No vehicles"
            description="Add your fleet here — no need to wait for HIGHLINK admin."
            icon={<Car className="h-4 w-4" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((v) => {
              const related = permits.filter((p) => p.vehicleId === v.id).length;
              return (
                <article
                  key={v.id}
                  className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-lg font-bold tracking-wide text-[#1b1a19]">
                        {v.plateNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-[#605e5c]">
                        {[v.make, v.model, v.color].filter(Boolean).join(' · ') ||
                          v.vehicleType}
                      </p>
                    </div>
                    <StatusPill status={v.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <p className="mt-3 text-xs text-[#323130]">
                    Owner: {v.ownerName ?? '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8886]">
                    {v.vehicleType.replace(/_/g, ' ')}
                    {related ? ` · ${related} permit${related === 1 ? '' : 's'}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edebe9] pt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0078d4] hover:bg-[#deecf9]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {v.isActive ? (
                      <button
                        type="button"
                        onClick={() => openPermitRequest(v.id)}
                        disabled={sites.length === 0}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        Request permit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === v.id}
                      onClick={() => void toggleActive(v)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
                        v.isActive
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-teal-700 hover:bg-teal-50'
                      }`}
                    >
                      {v.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : loading && permits.length === 0 ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[#edebe9]" />
      ) : filteredPermits.length === 0 ? (
        <PortalEmpty
          title="No permits"
          description="Request a permit for an active vehicle — HIGHLINK parking ops will approve or reject it."
          icon={<Ticket className="h-4 w-4" />}
        />
      ) : (
        <PortalPanel title="Permits">
          <ul className="divide-y divide-[#edebe9]">
            {filteredPermits.map((p) => {
              const veh = vehicleById.get(p.vehicleId);
              const plate = p.plateNumber ?? veh?.plateNumber;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-[#1b1a19]">
                      {p.permitNumber}
                    </p>
                    <p className="text-xs text-[#605e5c]">
                      {p.permitType.replace(/_/g, ' ')}
                      {plate ? ` · ${plate}` : ''}
                      {p.siteCode || p.siteName
                        ? ` · ${[p.siteCode, p.siteName].filter(Boolean).join(' ')}`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8a8886]">
                      {formatDate(p.validFrom)} → {formatDate(p.validUntil)}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              );
            })}
          </ul>
        </PortalPanel>
      )}

      <PortalDeferral note="Approve/reject and RFID/ANPR/blacklist stay with HIGHLINK parking ops. You register vehicles and submit permit requests only." />

      {modal === 'permit' ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => void onSave(e)}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1b1a19]">
                  Request permit
                </h2>
                <p className="text-sm text-[#605e5c]">
                  Submits as PENDING. Valid today → +1 year until ops approve.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {formError}
              </p>
            ) : null}

            <label className="block text-sm font-medium text-[#323130]">
              Vehicle *
              <select
                className={inputCls}
                value={permitForm.vehicleId}
                onChange={(e) =>
                  setPermitForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
                required
              >
                <option value="">Select vehicle…</option>
                {vehicles
                  .filter((v) => v.isActive)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber}
                      {v.make || v.model
                        ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}`
                        : ''}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Site *
              <select
                className={inputCls}
                value={permitForm.siteId}
                onChange={(e) =>
                  setPermitForm((f) => ({ ...f, siteId: e.target.value }))
                }
                required
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Permit type
              <select
                className={inputCls}
                value={permitForm.permitType}
                onChange={(e) =>
                  setPermitForm((f) => ({
                    ...f,
                    permitType: e.target.value as (typeof PERMIT_TYPES)[number],
                  }))
                }
              >
                {PERMIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {modal === 'add' || modal === 'edit' ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={(e) => void onSave(e)}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1b1a19]">
                  {modal === 'add' ? 'Add vehicle' : 'Edit vehicle'}
                </h2>
                <p className="text-sm text-[#605e5c]">
                  Bound to your organisation only. Plate cannot change after create.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1.5 text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {formError}
              </p>
            ) : null}

            <label className="block text-sm font-medium text-[#323130]">
              Plate number *
              <input
                className={inputCls}
                value={form.plateNumber}
                disabled={modal === 'edit'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    plateNumber: e.target.value.toUpperCase(),
                  }))
                }
                required={modal === 'add'}
                minLength={3}
                placeholder="T123ABC"
              />
            </label>

            <label className="block text-sm font-medium text-[#323130]">
              Type
              <select
                className={inputCls}
                value={form.vehicleType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    vehicleType: e.target.value as VehicleForm['vehicleType'],
                  }))
                }
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Make
                <input
                  className={inputCls}
                  value={form.make}
                  onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Model
                <input
                  className={inputCls}
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-[#323130]">
              Colour
              <input
                className={inputCls}
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Owner name
                <input
                  className={inputCls}
                  value={form.ownerName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                Owner phone
                <input
                  className={inputCls}
                  value={form.ownerPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerPhone: e.target.value }))
                  }
                  placeholder="+255…"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#605e5c] hover:bg-[#f3f2f1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                {saving ? 'Saving…' : modal === 'add' ? 'Register' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
