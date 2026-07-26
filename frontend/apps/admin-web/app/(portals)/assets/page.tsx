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
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Package, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AssetsShell } from './_components/AssetsShell';

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

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

  const assigneeLabel = useMemo(() => {
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
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {assets.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
              <Package className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-[#323130]">No assets yet</p>
            <p className="max-w-sm text-xs text-[#605e5c]">
              Register a tag (e.g. radio, boots, phone) then assign it to an
              employee or guard.
            </p>
          </div>
        ) : (
          <DataTable<Asset>
            loading={loading}
            keyField="id"
            rows={assets}
            emptyMessage="No assets"
            columns={[
              {
                key: 'assetTag',
                label: 'Tag',
                render: (r) => (
                  <span className="font-mono text-sm">{r.assetTag}</span>
                ),
              },
              {
                key: 'name',
                label: 'Name',
                render: (r) => r.name,
              },
              {
                key: 'category',
                label: 'Category',
                render: (r) => r.category ?? '—',
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'activeAssignment',
                label: 'Assignee',
                render: (r) => {
                  const a = r.activeAssignment;
                  if (!a) return '—';
                  const parts: string[] = [];
                  if (a.assignedToEmployeeId) {
                    parts.push(
                      assigneeLabel.emp.get(a.assignedToEmployeeId) ??
                        `Emp ${a.assignedToEmployeeId.slice(0, 8)}`,
                    );
                  }
                  if (a.assignedToGuardId) {
                    parts.push(
                      assigneeLabel.grd.get(a.assignedToGuardId) ??
                        `Guard ${a.assignedToGuardId.slice(0, 8)}`,
                    );
                  }
                  return (
                    <span className="text-xs text-[#605e5c]">
                      {parts.join(' · ') || '—'}
                    </span>
                  );
                },
              },
              {
                key: 'createdAt',
                label: 'Registered',
                render: (r) => formatDate(r.createdAt),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  if (r.status !== 'AVAILABLE') {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">
                        {r.status === 'ASSIGNED' ||
                        r.status === 'RETURN_PENDING'
                          ? 'Issued'
                          : r.status}
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => setAssignTarget(r)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

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
