'use client';

import {
  assignAsset,
  completeAssetMaintenance,
  createAsset,
  disposeAsset,
  getAssetHistory,
  listAssetAssigneeOptions,
  listAssetCategoryOptions,
  listAssets,
  recordAssetDamage,
  recordAssetReplacement,
  startAssetMaintenance,
  transferAsset,
  walkInReturnAsset,
  type Asset,
  type AssetAssigneeOptions,
  type AssetLifecycleEvent,
  type CategoryOption,
  type CreateAssetBody,
  type ReturnCondition,
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
  History,
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
  | 'maintenance'
  | 'disposed'
  | 'other';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'return_pending', label: 'Return pending' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'disposed', label: 'Disposed' },
  { id: 'other', label: 'Other' },
];

type LifecycleAction =
  | 'dispose'
  | 'maintenance'
  | 'complete-maintenance'
  | 'damage'
  | 'replace'
  | 'return'
  | 'history';

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [transferTarget, setTransferTarget] = useState<Asset | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    action: LifecycleAction;
    asset: Asset;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, opts, categoryOptions] = await Promise.all([
        listAssets(),
        listAssetAssigneeOptions(),
        listAssetCategoryOptions(),
      ]);
      setAssets(rows);
      setAssignees(opts);
      setCategories(categoryOptions);
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
      maintenance: 0,
      disposed: 0,
      other: 0,
    };
    for (const r of assets) {
      const s = norm(r.status);
      if (s === 'available') c.available += 1;
      else if (s === 'assigned') c.assigned += 1;
      else if (s === 'return_pending') c.return_pending += 1;
      else if (s === 'maintenance') c.maintenance += 1;
      else if (s === 'disposed') c.disposed += 1;
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
      if (statusFilter === 'maintenance' && s !== 'maintenance') return false;
      if (statusFilter === 'disposed' && s !== 'disposed') return false;
      if (
        statusFilter === 'other' &&
        (s === 'available' ||
          s === 'assigned' ||
          s === 'return_pending' ||
          s === 'maintenance' ||
          s === 'disposed')
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
      description="Register, assign, transfer, maintain and dispose equipment with a complete lifecycle history."
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
            Register · assign · transfer · maintain · dispose · audit history
          </p>
        </div>
      </div>

      <AssetRoster
        rows={filtered}
        loading={loading}
        assigneeLabel={resolveAssignee}
        onAssign={setAssignTarget}
        onTransfer={setTransferTarget}
        onDispose={(asset) => setLifecycleTarget({ action: 'dispose', asset })}
        onMaintenance={(asset) =>
          setLifecycleTarget({ action: 'maintenance', asset })
        }
        onCompleteMaintenance={(asset) =>
          setLifecycleTarget({ action: 'complete-maintenance', asset })
        }
        onDamage={(asset) => setLifecycleTarget({ action: 'damage', asset })}
        onReplace={(asset) => setLifecycleTarget({ action: 'replace', asset })}
        onHistory={(asset) => setLifecycleTarget({ action: 'history', asset })}
        onWalkInReturn={(asset) =>
          setLifecycleTarget({ action: 'return', asset })
        }
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
          categories={categories}
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

      {transferTarget ? (
        <AssignAssetModal
          asset={transferTarget}
          assignees={assignees}
          operation="transfer"
          onClose={() => setTransferTarget(null)}
          onAssigned={async () => {
            setTransferTarget(null);
            await refresh();
          }}
        />
      ) : null}

      {lifecycleTarget ? (
        <LifecycleModal
          action={lifecycleTarget.action}
          asset={lifecycleTarget.asset}
          assets={assets}
          onClose={() => setLifecycleTarget(null)}
          onCompleted={async () => {
            setLifecycleTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </AssetsShell>
  );
}

function CreateAssetModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: CategoryOption[];
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
          <select
            className={`${inputCls} mt-1`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select category…</option>
            {categories.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
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
  operation = 'assign',
  onClose,
  onAssigned,
}: {
  asset: Asset;
  assignees: AssetAssigneeOptions;
  operation?: 'assign' | 'transfer';
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
        const body = {
          assignedToEmployeeId: employeeId,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        if (operation === 'transfer') await transferAsset(asset.id, body);
        else await assignAsset(asset.id, body);
      } else {
        if (!guardId) throw new Error('Select a guard');
        const body = {
          assignedToGuardId: guardId,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        if (operation === 'transfer') await transferAsset(asset.id, body);
        else await assignAsset(asset.id, body);
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
      title={operation === 'transfer' ? 'Transfer asset' : 'Assign asset'}
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
            placeholder={
              operation === 'transfer'
                ? 'Optional transfer notes'
                : 'Optional issue notes'
            }
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
            {submitting
              ? operation === 'transfer'
                ? 'Transferring…'
                : 'Assigning…'
              : operation === 'transfer'
                ? 'Transfer'
                : 'Assign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ACTION_COPY: Record<
  Exclude<LifecycleAction, 'history'>,
  { title: string; description: string; submit: string }
> = {
  dispose: {
    title: 'Dispose asset',
    description: 'Permanently remove this asset from active inventory.',
    submit: 'Dispose',
  },
  maintenance: {
    title: 'Start maintenance',
    description: 'Move this asset into maintenance.',
    submit: 'Start maintenance',
  },
  'complete-maintenance': {
    title: 'Complete maintenance',
    description: 'Return this asset to available inventory.',
    submit: 'Complete',
  },
  damage: {
    title: 'Record damage',
    description: 'Record the asset condition and damage details.',
    submit: 'Record damage',
  },
  replace: {
    title: 'Record replacement',
    description: 'Link another registered asset as its replacement.',
    submit: 'Record replacement',
  },
  return: {
    title: 'Walk-in return',
    description: 'Receive an assigned asset directly into inventory.',
    submit: 'Receive asset',
  },
};

function LifecycleModal({
  action,
  asset,
  assets,
  onClose,
  onCompleted,
}: {
  action: LifecycleAction;
  asset: Asset;
  assets: Asset[];
  onClose: () => void;
  onCompleted: () => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState<ReturnCondition>('GOOD');
  const [replacementAssetId, setReplacementAssetId] = useState('');
  const [events, setEvents] = useState<AssetLifecycleEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(action === 'history');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (action !== 'history') return;
    let active = true;
    void getAssetHistory(asset.id)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (active) setError(formatApiError(err));
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [action, asset.id]);

  if (action === 'history') {
    return (
      <Modal
        title="Asset history"
        description={`${asset.assetTag} · ${asset.name}`}
        onClose={onClose}
        size="lg"
      >
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : loadingHistory ? (
          <p className="py-8 text-center text-sm text-[#605e5c]">
            Loading history…
          </p>
        ) : events.length === 0 ? (
          <AssetsEmpty
            title="No lifecycle events"
            description="Transfers, maintenance, damage and disposal events will appear here."
          />
        ) : (
          <ol className="space-y-0">
            {events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3 pb-5">
                {index < events.length - 1 ? (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-[#e1dfdd]" />
                ) : null}
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6fc] text-[#0078d4] ring-4 ring-white">
                  <History className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-[#323130]">
                    {event.eventType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-[#8a8886]">
                    {new Date(event.createdAt).toLocaleString('en-GB')}
                    {event.fromStatus || event.toStatus
                      ? ` · ${event.fromStatus ?? '—'} → ${event.toStatus ?? '—'}`
                      : ''}
                  </p>
                  {event.notes ? (
                    <p className="mt-1 text-xs text-[#605e5c]">{event.notes}</p>
                  ) : null}
                  {event.condition ? (
                    <p className="mt-1 text-[11px] font-medium text-[#605e5c]">
                      Condition: {event.condition}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2 flex justify-end">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  const copy = ACTION_COPY[action];
  const replacementOptions = assets.filter(
    (candidate) =>
      candidate.id !== asset.id && norm(candidate.status) !== 'disposed',
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cleanNotes = notes.trim();
      if (action === 'dispose') {
        if (cleanNotes.length < 3) throw new Error('Enter a disposal reason');
        await disposeAsset(asset.id, { reason: cleanNotes });
      } else if (action === 'maintenance') {
        await startAssetMaintenance(asset.id, {
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        });
      } else if (action === 'complete-maintenance') {
        await completeAssetMaintenance(asset.id, {
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        });
      } else if (action === 'damage') {
        if (!cleanNotes) throw new Error('Enter damage details');
        await recordAssetDamage(asset.id, { notes: cleanNotes, condition });
      } else if (action === 'replace') {
        if (!replacementAssetId) throw new Error('Select a replacement asset');
        await recordAssetReplacement(asset.id, {
          replacementAssetId,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        });
      } else {
        await walkInReturnAsset(asset.id, {
          condition,
          ...(cleanNotes ? { receiptNote: cleanNotes } : {}),
        });
      }
      await onCompleted();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={copy.title}
      description={`${asset.assetTag} · ${asset.name}. ${copy.description}`}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        {action === 'replace' ? (
          <label className="block text-sm font-medium text-[#323130]">
            Replacement asset
            <select
              className={`${inputCls} mt-1`}
              value={replacementAssetId}
              onChange={(e) => setReplacementAssetId(e.target.value)}
              required
            >
              <option value="">Select asset…</option>
              {replacementOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.assetTag} · {candidate.name} ({candidate.status})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {action === 'damage' || action === 'return' ? (
          <label className="block text-sm font-medium text-[#323130]">
            Condition
            <select
              className={`${inputCls} mt-1`}
              value={condition}
              onChange={(e) => setCondition(e.target.value as ReturnCondition)}
            >
              <option value="GOOD">Good</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </select>
          </label>
        ) : null}

        <label className="block text-sm font-medium text-[#323130]">
          {action === 'dispose'
            ? 'Disposal reason'
            : action === 'damage'
              ? 'Damage details'
              : action === 'return'
                ? 'Receipt note'
                : 'Notes'}
          <textarea
            className={`${inputCls} mt-1 min-h-[88px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required={action === 'dispose' || action === 'damage'}
            placeholder={
              action === 'dispose'
                ? 'Reason for disposal'
                : action === 'damage'
                  ? 'Describe the damage'
                  : 'Optional notes'
            }
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
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Saving…' : copy.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
