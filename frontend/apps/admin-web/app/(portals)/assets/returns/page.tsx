'use client';

import {
  confirmReturn,
  listAssetAssigneeOptions,
  listPendingReturns,
  type AssetAssigneeOptions,
  type PendingReturnAssignment,
  type ReturnCondition,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  Modal,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Clock3,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AssetsEmpty, ReturnsRoster } from '../_components/AssetRoster';
import { AssetsShell } from '../_components/AssetsShell';

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

export default function AssetReturnsPage() {
  const [rows, setRows] = useState<PendingReturnAssignment[]>([]);
  const [assignees, setAssignees] = useState<AssetAssigneeOptions>({
    employees: [],
    guards: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] =
    useState<PendingReturnAssignment | null>(null);
  const [query, setQuery] = useState('');
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, opts] = await Promise.all([
        listPendingReturns(),
        listAssetAssigneeOptions().catch(() => ({
          employees: [],
          guards: [],
        })),
      ]);
      setRows(pending);
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

  const holderMaps = useMemo(() => {
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

  const holderLabel = useCallback(
    (r: PendingReturnAssignment): string | null => {
      const parts: string[] = [];
      if (r.assignedToEmployeeId) {
        parts.push(
          holderMaps.emp.get(r.assignedToEmployeeId) ??
            `Emp ${r.assignedToEmployeeId.slice(0, 8)}`,
        );
      }
      if (r.assignedToGuardId) {
        parts.push(
          holderMaps.grd.get(r.assignedToGuardId) ??
            `Guard ${r.assignedToGuardId.slice(0, 8)}`,
        );
      }
      return parts.length ? parts.join(' · ') : null;
    },
    [holderMaps],
  );

  const ownCount = useMemo(() => {
    if (!sessionUser?.id) return 0;
    return rows.filter(
      (r) =>
        !!r.returnRequestedBy && r.returnRequestedBy === sessionUser.id,
    ).length;
  }, [rows, sessionUser?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const holder = (holderLabel(r) ?? '').toLowerCase();
      return (
        (r.assetTag ?? '').toLowerCase().includes(q) ||
        (r.assetName ?? '').toLowerCase().includes(q) ||
        (r.assetCategory ?? '').toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q) ||
        holder.includes(q)
      );
    });
  }, [rows, query, holderLabel]);

  return (
    <AssetsShell
      title="Equipment returns"
      description="Confirm ESS return requests with condition and receipt note. Creator cannot confirm their own request."
      actions={
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
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Pending returns"
          value={rows.length}
          hint="ESS return queue"
          accent="amber"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Ready to confirm"
          value={Math.max(rows.length - ownCount, 0)}
          hint="Storekeeper can act"
          accent="emerald"
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Your requests"
          value={ownCount}
          hint="Creator ≠ confirmer"
          accent="sky"
          icon={<ShieldAlert className="h-5 w-5" />}
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
            <PackageCheck className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Return queue
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Confirm condition + receipt · register stays under Register
          </p>
        </div>
      </div>

      <ReturnsRoster
        rows={filtered}
        loading={loading}
        holderLabel={holderLabel}
        onConfirm={setConfirmTarget}
        canConfirm={(r) => {
          const isOwn =
            !!sessionUser?.id &&
            !!r.returnRequestedBy &&
            r.returnRequestedBy === sessionUser.id;
          if (isOwn) return 'own';
          return true;
        }}
        toolbar={
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
            <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag, asset, holder, notes…"
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
            />
          </label>
        }
        empty={
          <AssetsEmpty
            icon="returns"
            title={rows.length === 0 ? 'No pending returns' : 'No matches'}
            description={
              rows.length === 0
                ? 'When an employee requests a return via ESS, it appears here for storekeeper confirmation.'
                : 'Try another search.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} pending returns
        </p>
      ) : null}

      {confirmTarget ? (
        <ConfirmReturnModal
          row={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={async () => {
            setConfirmTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </AssetsShell>
  );
}

function ConfirmReturnModal({
  row,
  onClose,
  onConfirmed,
}: {
  row: PendingReturnAssignment;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
}) {
  const [condition, setCondition] = useState<ReturnCondition>('GOOD');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await confirmReturn(row.id, {
        condition,
        ...(receiptNote.trim()
          ? { receiptNote: receiptNote.trim() }
          : {}),
      });
      await onConfirmed();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Confirm equipment return"
      description={`${row.assetTag ?? 'Asset'} · ${row.assetName ?? row.assetId}`}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Condition
          <select
            className={`${inputCls} mt-1`}
            value={condition}
            onChange={(e) =>
              setCondition(e.target.value as ReturnCondition)
            }
            required
          >
            <option value="GOOD">Good</option>
            <option value="DAMAGED">Damaged</option>
            <option value="LOST">Lost</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Receipt note
          <textarea
            className={`${inputCls} mt-1 min-h-[72px]`}
            value={receiptNote}
            onChange={(e) => setReceiptNote(e.target.value)}
            placeholder="Optional receipt / handover note"
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
            {submitting ? 'Confirming…' : 'Confirm return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
