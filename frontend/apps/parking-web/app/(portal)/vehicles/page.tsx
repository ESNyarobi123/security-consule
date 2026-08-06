'use client';

import {
  listVehicles,
  updateVehicle,
  type ParkingOpsVehicle,
} from '@pssms/api-client';
import {
  LayoutGrid,
  List,
  Nfc,
  RefreshCw,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type ViewMode = 'cards' | 'table';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [rfidFilter, setRfidFilter] = useState<'ALL' | 'TAGGED' | 'UNTAGGED'>(
    'ALL',
  );
  const [view, setView] = useState<ViewMode>('cards');
  const [edit, setEdit] = useState<ParkingOpsVehicle | null>(null);
  const [rfidDraft, setRfidDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await listVehicles());
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
    return {
      ALL: vehicles.length,
      TAGGED: tagged,
      UNTAGGED: vehicles.length - tagged,
    };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const kind = normalizeVehicleType(v.vehicleType);
      if (typeFilter !== 'ALL' && kind !== typeFilter) return false;
      if (rfidFilter === 'TAGGED' && !v.rfidTagRef) return false;
      if (rfidFilter === 'UNTAGGED' && v.rfidTagRef) return false;
      if (!q) return true;
      return [
        v.plateNumber,
        v.make,
        v.model,
        v.ownerName,
        v.rfidTagRef,
        v.color,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [vehicles, search, typeFilter, rfidFilter]);

  function openEdit(v: ParkingOpsVehicle) {
    setEdit(v);
    setRfidDraft(v.rfidTagRef ?? '');
    setModalError(null);
  }

  async function saveRfid(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setModalError(null);
    try {
      const next = rfidDraft.trim();
      const updated = await updateVehicle(edit.id, {
        rfidTagRef: next.length ? next : null,
      });
      setVehicles((prev) =>
        prev.map((v) => (v.id === updated.id ? updated : v)),
      );
      setEdit(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access · Module 13-A
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Vehicles
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Register RFID / tag refs on vehicles. Barrier MQTT ingest comes
            later — this stores the tag for ops and owner visibility.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['ALL', 'All vehicles', counts.ALL],
            ['TAGGED', 'With RFID', counts.TAGGED],
            ['UNTAGGED', 'No RFID', counts.UNTAGGED],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRfidFilter(key)}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              rfidFilter === key
                ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{n}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, RFID, owner…"
            className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as VehicleKind | 'ALL')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">All types</option>
          {(Object.keys(VEHICLE_META) as VehicleKind[]).map((k) => (
            <option key={k} value={k}>
              {VEHICLE_META[k].label}
            </option>
          ))}
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
        <p className="text-sm text-slate-500">No vehicles match filters.</p>
      ) : view === 'cards' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => {
            const kind = normalizeVehicleType(v.vehicleType);
            return (
              <li
                key={v.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit RFID
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  {v.ownerName ? (
                    <span className="text-xs text-slate-500">{v.ownerName}</span>
                  ) : null}
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
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">RFID tag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {v.plateNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.vehicleType}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.ownerName ?? '—'}
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
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="text-xs font-medium text-[#0078d4] hover:underline"
                    >
                      Edit RFID
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={(e) => void saveRfid(e)}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Edit RFID tag
                </h2>
                <p className="text-sm text-slate-600">{edit.plateNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              RFID / tag ref
            </label>
            <input
              value={rfidDraft}
              onChange={(e) => setRfidDraft(e.target.value)}
              placeholder="e.g. RFID-DEMO-T123"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave blank and save to clear. Duplicate tags return 409
              RFID_TAG_IN_USE.
            </p>
            {modalError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {modalError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0f2744] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
