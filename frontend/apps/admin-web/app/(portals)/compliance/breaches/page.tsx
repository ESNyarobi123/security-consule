'use client';

import {
  createBreach,
  listBreaches,
  updateBreach,
  type BreachSeverity,
  type BreachStatus,
  type CreateBreachBody,
  type DataBreachCase,
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
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import {
  BREACH_NEXT,
  formatApiError,
  formatDate,
  formatDateTime,
  norm,
} from '../_components/shared';

export default function ComplianceBreachesPage() {
  const [rows, setRows] = useState<DataBreachCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listBreaches());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const advance = async (row: DataBreachCase) => {
    const next = BREACH_NEXT[norm(row.status)];
    if (!next) return;
    setBusyId(row.id);
    setError(null);
    try {
      await updateBreach(row.id, { status: next as BreachStatus });
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ComplianceShell
      title="DPO data breach register"
      description="Personal-data breach cases for Compliance / DPO. Separate from ops incident SECURITY_BREACH. Status advances REPORTED → INVESTIGATING → CONTAINED → CLOSED only."
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
            Report breach
          </button>
        </>
      }
    >
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        This is the DPO register for personal-data breaches — not the field
        operations incident log. Risk register / DPIA remain deferred.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fff4ce] text-[#8a6914]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-[#323130]">
              No breach cases
            </p>
            <p className="max-w-sm text-xs text-[#605e5c]">
              Report a suspected personal-data breach to open a DPO case.
            </p>
          </div>
        ) : (
          <DataTable<DataBreachCase>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No breaches"
            columns={[
              {
                key: 'referenceCode',
                label: 'Ref',
                render: (r) => (
                  <span className="font-mono text-xs">{r.referenceCode}</span>
                ),
              },
              { key: 'title', label: 'Title' },
              {
                key: 'severity',
                label: 'Severity',
                render: (r) => <StatusBadge status={r.severity} />,
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'discoveredAt',
                label: 'Discovered',
                render: (r) => (
                  <span className="text-xs">{formatDate(r.discoveredAt)}</span>
                ),
              },
              {
                key: 'reportedAt',
                label: 'Reported',
                render: (r) => (
                  <span className="text-xs">{formatDateTime(r.reportedAt)}</span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const next = BREACH_NEXT[norm(r.status)];
                  if (!next) {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">Closed</span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => void advance(r)}
                    >
                      → {next.replace(/_/g, ' ')}
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateBreachModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </ComplianceShell>
  );
}

function CreateBreachModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateBreachBody>({
    title: '',
    description: '',
    severity: 'MEDIUM',
    discoveredAt: new Date().toISOString().slice(0, 16),
    affectedDataCategories: '',
    estimatedRecords: undefined,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const discoveredAt = new Date(form.discoveredAt).toISOString();
      await createBreach({
        title: form.title,
        description: form.description,
        severity: form.severity,
        discoveredAt,
        affectedDataCategories:
          form.affectedDataCategories?.trim() || undefined,
        estimatedRecords:
          form.estimatedRecords !== undefined &&
          !Number.isNaN(form.estimatedRecords)
            ? Number(form.estimatedRecords)
            : undefined,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Report data breach" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs text-[#605e5c]">
          Title
          <input
            className={`${inputCls} mt-1`}
            required
            minLength={3}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Description
          <textarea
            className={`${inputCls} mt-1 min-h-[100px]`}
            required
            minLength={10}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[#605e5c]">
            Severity
            <select
              className={`${inputCls} mt-1`}
              value={form.severity}
              onChange={(e) =>
                setForm({
                  ...form,
                  severity: e.target.value as BreachSeverity,
                })
              }
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="block text-xs text-[#605e5c]">
            Discovered at
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              required
              value={form.discoveredAt}
              onChange={(e) =>
                setForm({ ...form, discoveredAt: e.target.value })
              }
            />
          </label>
        </div>
        <label className="block text-xs text-[#605e5c]">
          Affected data categories (optional)
          <input
            className={`${inputCls} mt-1`}
            value={form.affectedDataCategories ?? ''}
            onChange={(e) =>
              setForm({ ...form, affectedDataCategories: e.target.value })
            }
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Estimated records (optional)
          <input
            type="number"
            min={0}
            className={`${inputCls} mt-1`}
            value={form.estimatedRecords ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                estimatedRecords: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Saving…' : 'Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
