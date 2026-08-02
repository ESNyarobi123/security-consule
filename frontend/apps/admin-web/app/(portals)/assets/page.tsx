'use client';

import {
  assignAsset,
  createAsset,
  listAssetAssigneeOptions,
  listAssets,
  type Asset,
  type AssetAssigneeOptions,
  type CreateAssetBody,
} from '@pssms/api-client';
import {
  Modal,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  CheckCircle2,
  Clock3,
  Package,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AssetRoster, AssetsEmpty } from './_components/AssetRoster';
import { AssetsShell } from './_components/AssetsShell';

type StatusFilter =
  | 'all'
  | 'available'
  | 'assigned'
  | 'return_pending'
  | 'other';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'return_pending', label: 'Return pending' },
  { id: 'other', label: 'Other' },
];

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* plain text */
  }
  return raw;
}

export default function AssetsRegisterPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignees, setAssignees] = useState<AssetAssigneeOptions>({
    employees: [],
    guards: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, opts] = await Promise.all([
        listAssets(),
        listAssetAssigneeOptions(),
      ]);
      setAssets(rows);
      setAssignees(opts);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const assigneeMaps = useMemo(() => {
    const emp = new Map(
      assignees.employees.map((e) => [
        e.id,
        `${e.fullName} (${e.employeeNumber})`,
      ]),
    );
    const grd = new Map(
      assignees.guards.map((g) => [
        g.id,
        `${g.fullName} (${g.employeeNumber})`,
      ]),
    );
    return { emp, grd };
  }, [assignees]);

  const resolveAssignee = useCallback(
    (r: Asset): string | null => {
      const a = r.activeAssignment;
      if (!a) return null;
      const parts: string[] = [];
      if (a.assignedToEmployeeId) {
        parts.push(
          assigneeMaps.emp.get(a.assignedToEmployeeId) ??
            `Emp ${a.assignedToEmployeeId.slice(0, 8)}`,
        );
      }
      if (a.assignedToGuardId) {
        parts.push(
          assigneeMaps.grd.get(a.assignedToGuardId) ??
            `Guard ${a.assignedToGuardId.slice(0, 8)}`,
        );
      }
      return parts.length ? parts.join(' · ') : null;
    },
    [assigneeMaps],
  );

  const counts = useMemo(() => {
    const c = {
      all: assets.length,
      available: 0,
      assigned: 0,
      return_pending: 0,
      other: 0,
    };
    for (const r of assets) {
      const s = norm(r.status);
      if (s === 'available') c.available += 1;
      else if (s === 'assigned') c.assigned += 1;
      else if (s === 'return_pending') c.return_pending += 1;
      else c.other += 1;
    }
    return c;
  }, [assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((r) => {
      const s = norm(r.status);
      if (statusFilter === 'available' && s !== 'available') return false;
      if (statusFilter === 'assigned' && s !== 'assigned') return false;
      if (statusFilter === 'return_pending' && s !== 'return_pending')
        return false;
      if (
        statusFilter === 'other' &&
        (s === 'available' || s === 'assigned' || s === 'return_pending')
      )
        return false;
      if (!q) return true;
      const who = (resolveAssignee(r) ?? '').toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.assetTag.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        (r.serialNumber ?? '').toLowerCase().includes(q) ||
        who.includes(q)
      );
    });
  }, [assets, query, statusFilter, resolveAssignee]);

  return (
    <AssetsShell
      title="Asset register"
      description="Register equipment and assign to employees or guards. ESS return confirm stays under Returns."
      actions={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            Register asset
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total assets"
          value={counts.all}
          hint="Tagged equipment"
          accent="blue"
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="Available"
          value={counts.available}
          hint="Ready to assign"
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Assigned"
          value={counts.assigned}
          hint="With employees / guards"
          accent="sky"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Return pending"
          value={counts.return_pending}
          hint="Confirm under Returns"
          accent="amber"
          icon={<Clock3 className="h-5 w-5" />}
        />
      </div>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Assets
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Register tags · assign to employee/guard · ESS returns under Returns
          </p>
        </div>
      </div>

      <AssetRoster
        rows={filtered}
        loading={loading}
        assigneeLabel={resolveAssignee}
        onAssign={setAssignTarget}
        toolbar={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tag, name, category, assignee…"
                className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[#0078d4] text-white shadow-sm'
                        : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`tabular-nums ${
                        active ? 'text-white/80' : 'text-[#a19f9d]'
                      }`}
                    >
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        }
        empty={
          <AssetsEmpty
            title={assets.length === 0 ? 'No assets yet' : 'No matches'}
            description={
              assets.length === 0
                ? 'Register a tag (e.g. radio, boots, phone) then assign it to an employee or guard.'
                : 'Try another search or status filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {assets.length} assets
        </p>
      ) : null}

      {createOpen ? (
        <CreateAssetModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {assignTarget ? (
        <AssignAssetModal
          asset={assignTarget}
          assignees={assignees}
          onClose={() => setAssignTarget(null)}
          onAssigned={async () => {
            setAssignTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </AssetsShell>
  );
}

function CreateAssetModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateAssetBody = {
        assetTag: assetTag.trim(),
        name: name.trim(),
      };
      if (category.trim()) body.category = category.trim();
      if (serialNumber.trim()) body.serialNumber = serialNumber.trim();
      if (purchaseCost.trim()) {
        const n = Number(purchaseCost);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error('Purchase cost must be a non-negative number');
        }
        body.purchaseCost = n;
      }
      await createAsset(body);
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Register asset"
      description="Create a tagged asset in AVAILABLE status."
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Asset tag
          <input
            className={`${inputCls} mt-1`}
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            placeholder="AST-RADIO-002"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Handheld Radio R2"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Category
          <input
            className={`${inputCls} mt-1`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="RADIO / BOOTS / PHONE"
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Serial number
          <input
            className={`${inputCls} mt-1`}
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Purchase cost (TZS)
          <input
            className={`${inputCls} mt-1`}
            type="number"
            min={0}
            step="1"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
            placeholder="Optional"
          />
        </label>
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Register'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignAssetModal({
  asset,
  assignees,
  onClose,
  onAssigned,
}: {
  asset: Asset;
  assignees: AssetAssigneeOptions;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'employee' | 'guard'>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [guardId, setGuardId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'employee') {
        if (!employeeId) throw new Error('Select an employee');
        await assignAsset(asset.id, {
          assignedToEmployeeId: employeeId,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      } else {
        if (!guardId) throw new Error('Select a guard');
        await assignAsset(asset.id, {
          assignedToGuardId: guardId,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      }
      await onAssigned();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Assign asset"
      description={`${asset.assetTag} · ${asset.name}`}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[#323130]">
            Assign to
          </legend>
          <div className="flex gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="assigneeMode"
                checked={mode === 'employee'}
                onChange={() => setMode('employee')}
              />
              Employee
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="assigneeMode"
                checked={mode === 'guard'}
                onChange={() => setMode('guard')}
              />
              Guard
            </label>
          </div>
        </fieldset>

        {mode === 'employee' ? (
          <label className="block text-sm font-medium text-[#323130]">
            Employee
            <select
              className={`${inputCls} mt-1`}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {assignees.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeNumber})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-sm font-medium text-[#323130]">
            Guard
            <select
              className={`${inputCls} mt-1`}
              value={guardId}
              onChange={(e) => setGuardId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {assignees.guards.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.fullName} ({g.employeeNumber})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm font-medium text-[#323130]">
          Notes
          <textarea
            className={`${inputCls} mt-1 min-h-[64px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional issue notes"
          />
        </label>

        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting}
          >
            {submitting ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
