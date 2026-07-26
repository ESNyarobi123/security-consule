'use client';

import {
  confirmReturn,
  listPendingReturns,
  type PendingReturnAssignment,
  type ReturnCondition,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { PackageCheck, RefreshCw } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AssetsShell } from '../_components/AssetsShell';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export default function AssetReturnsPage() {
  const [rows, setRows] = useState<PendingReturnAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] =
    useState<PendingReturnAssignment | null>(null);
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPendingReturns());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <PackageCheck className="h-5 w-5 text-[#a19f9d]" />
            <p>No pending return requests</p>
          </div>
        ) : (
          <DataTable<PendingReturnAssignment>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No pending returns"
            columns={[
              {
                key: 'assetTag',
                label: 'Tag',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {r.assetTag ?? r.assetId.slice(0, 8)}
                  </span>
                ),
              },
              {
                key: 'assetName',
                label: 'Asset',
                render: (r) => r.assetName ?? '—',
              },
              {
                key: 'assetCategory',
                label: 'Category',
                render: (r) => r.assetCategory ?? '—',
              },
              {
                key: 'assetStatus',
                label: 'Status',
                render: (r) => (
                  <StatusBadge status={r.assetStatus ?? 'RETURN_PENDING'} />
                ),
              },
              {
                key: 'returnRequestedAt',
                label: 'Requested',
                render: (r) => formatDate(r.returnRequestedAt),
              },
              {
                key: 'notes',
                label: 'Notes',
                render: (r) => (
                  <span
                    className="max-w-[140px] truncate text-xs text-[#605e5c]"
                    title={r.notes ?? undefined}
                  >
                    {r.notes ?? '—'}
                  </span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const isOwn =
                    !!sessionUser?.id &&
                    !!r.returnRequestedBy &&
                    r.returnRequestedBy === sessionUser.id;
                  if (isOwn) {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">
                        Awaiting other confirmer
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => setConfirmTarget(r)}
                    >
                      Confirm
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

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
