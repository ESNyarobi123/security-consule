'use client';

import {
  createGate,
  listGates,
  listSites,
  updateGate,
  type GateType,
  type Site,
  type SiteGate,
} from '@pssms/api-client';
import {
  Modal,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  DoorOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDate } from '../_components/shared';

type StatusFilter = 'all' | 'active' | 'inactive';
type TypeFilter = 'all' | GateType;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'PEDESTRIAN', label: 'Pedestrian' },
  { id: 'VEHICLE', label: 'Vehicle' },
  { id: 'MIXED', label: 'Mixed' },
];

const GATE_TYPE_OPTIONS: { id: GateType; label: string }[] = [
  { id: 'MIXED', label: 'Mixed' },
  { id: 'PEDESTRIAN', label: 'Pedestrian' },
  { id: 'VEHICLE', label: 'Vehicle' },
];

function typeLabel(t: string) {
  const hit = GATE_TYPE_OPTIONS.find((o) => o.id === t);
  return hit?.label ?? t;
}

export default function BranchAccessPointsPage() {
  const [rows, setRows] = useState<SiteGate[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SiteGate | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gates, siteRows] = await Promise.all([listGates(), listSites()]);
      setRows(gates);
      setSites(siteRows.filter((s) => s.isActive));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      active: 0,
      inactive: 0,
      pedestrian: 0,
      vehicle: 0,
      mixed: 0,
    };
    for (const r of rows) {
      if (r.isActive) c.active += 1;
      else c.inactive += 1;
      if (r.gateType === 'PEDESTRIAN') c.pedestrian += 1;
      else if (r.gateType === 'VEHICLE') c.vehicle += 1;
      else c.mixed += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      if (typeFilter !== 'all' && r.gateType !== typeFilter) return false;
      if (siteFilter !== 'all' && r.siteId !== siteFilter) return false;
      if (!q) return true;
      const site = `${r.siteCode ?? ''} ${r.siteName ?? ''}`.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        site.includes(q) ||
        r.gateType.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, typeFilter, siteFilter]);

  async function toggleActive(gate: SiteGate) {
    setBusyId(gate.id);
    setError(null);
    try {
      await updateGate(gate.id, { isActive: !gate.isActive });
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <BranchShell
      title="Access points"
      description="Site gates for visitor, parking and access control. Field Officers supervise points under their assigned sites."
      actions={
        <>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setCreateOpen(true)}
            disabled={sites.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            Add gate
          </button>
        </>
      }
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
        >
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gates" value={counts.all} hint="All access points" />
        <StatCard label="Active" value={counts.active} hint="In service" />
        <StatCard
          label="Vehicle"
          value={counts.vehicle}
          hint={`${counts.pedestrian} pedestrian · ${counts.mixed} mixed`}
        />
        <StatCard
          label="Inactive"
          value={counts.inactive}
          hint="Deactivated"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a19f9d]" />
              <input
                className={`${inputCls} !pl-8`}
                placeholder="Search code, name, site…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.id;
                const n =
                  f.id === 'all'
                    ? counts.all
                    : f.id === 'active'
                      ? counts.active
                      : counts.inactive;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[#0f172a] text-white shadow-sm'
                        : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`tabular-nums ${
                        active ? 'text-white/70' : 'text-[#a19f9d]'
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {TYPE_FILTERS.map((f) => {
                const active = typeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[#12263f] text-sky-100 shadow-sm ring-1 ring-sky-400/30'
                        : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            {sites.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSiteFilter('all')}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    siteFilter === 'all'
                      ? 'bg-[#0f172a] text-white shadow-sm'
                      : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                  }`}
                >
                  All sites
                </button>
                {sites.map((s) => {
                  const active = siteFilter === s.id;
                  const n = rows.filter((r) => r.siteId === s.id).length;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSiteFilter(s.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0f172a] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {s.code}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/70' : 'text-[#a19f9d]'
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto_auto] md:items-center md:gap-3">
          <span>Gate</span>
          <span>Site</span>
          <span>Type</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading && rows.length === 0 ? (
          <ul className="divide-y divide-[#f3f2f1]">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="animate-pulse px-4 py-3.5">
                <div className="h-10 w-full rounded-lg bg-[#edebe9]" />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <DoorOpen className="h-8 w-8 text-[#a19f9d]" />
            <p className="text-sm font-semibold text-[#323130]">
              {rows.length === 0 ? 'No access points yet' : 'No matches'}
            </p>
            <p className="max-w-sm text-xs text-[#605e5c]">
              {rows.length === 0
                ? 'Register pedestrian, vehicle or mixed gates on customer sites (needs operations.manage or enterprise.manage).'
                : 'Try another search, type, status, or site filter.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((g) => (
              <li
                key={g.id}
                className="grid gap-2 px-4 py-3.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto_auto] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1b1a19]">
                    {g.name}
                  </p>
                  <p className="font-mono text-[11px] text-[#605e5c]">
                    {g.code}
                    <span className="text-[#a19f9d]">
                      {' '}
                      · {formatDate(g.createdAt)}
                    </span>
                  </p>
                </div>
                <div className="min-w-0 text-sm text-[#323130]">
                  <p className="truncate font-medium">
                    {g.siteCode ?? '—'}
                  </p>
                  <p className="truncate text-[11px] text-[#605e5c]">
                    {g.siteName ?? g.siteId.slice(0, 8)}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900 ring-1 ring-sky-200/80">
                  {typeLabel(g.gateType)}
                </span>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                    g.isActive
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
                      : 'bg-slate-50 text-slate-600 ring-slate-200/80'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      g.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {g.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    className={`${btnSecondary} !px-2 !py-1 text-[11px]`}
                    onClick={() => setEditTarget(g)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} !px-2 !py-1 text-[11px]`}
                    disabled={busyId === g.id}
                    onClick={() => void toggleActive(g)}
                  >
                    <ShieldOff className="h-3 w-3" />
                    {g.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} gates
        </p>
      ) : null}

      {createOpen ? (
        <CreateGateModal
          sites={sites}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {editTarget ? (
        <EditGateModal
          gate={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </BranchShell>
  );
}

function CreateGateModal({
  sites,
  onClose,
  onCreated,
}: {
  sites: Site[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gateType, setGateType] = useState<GateType>('MIXED');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createGate({
        siteId,
        code: code.trim(),
        name: name.trim(),
        gateType,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add access point"
      description="Register a gate on a site under your Branch Ops scope."
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        {error ? (
          <p className="rounded-md bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#323130]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#323130]">
          Code
          <input
            className={`${inputCls} mt-1`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="GATE-WEST"
            required
            minLength={2}
          />
        </label>
        <label className="block text-xs font-medium text-[#323130]">
          Name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="West pedestrian gate"
            required
          />
        </label>
        <label className="block text-xs font-medium text-[#323130]">
          Type
          <select
            className={`${inputCls} mt-1`}
            value={gateType}
            onChange={(e) => setGateType(e.target.value as GateType)}
          >
            {GATE_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Create gate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditGateModal({
  gate,
  onClose,
  onSaved,
}: {
  gate: SiteGate;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(gate.name);
  const [gateType, setGateType] = useState<GateType>(
    (GATE_TYPE_OPTIONS.some((o) => o.id === gate.gateType)
      ? gate.gateType
      : 'MIXED') as GateType,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateGate(gate.id, {
        name: name.trim(),
        gateType,
      });
      await onSaved();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit access point"
      description={`${gate.code} · ${gate.siteCode ?? 'site'} (code is immutable)`}
      onClose={onClose}
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        {error ? (
          <p className="rounded-md bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#323130]">
          Name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium text-[#323130]">
          Type
          <select
            className={`${inputCls} mt-1`}
            value={gateType}
            onChange={(e) => setGateType(e.target.value as GateType)}
          >
            {GATE_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
