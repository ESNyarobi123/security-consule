'use client';

import {
  approvePolicy,
  archivePolicy,
  createPolicy,
  listPolicies,
  rejectPolicy,
  submitPolicy,
  type CreatePolicyBody,
  type PolicyDocument,
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
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError, formatDate, norm } from '../_components/shared';

export default function CompliancePoliciesPage() {
  const [rows, setRows] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PolicyDocument | null>(null);
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPolicies());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ComplianceShell
      title="Policy documents"
      description="Draft → submit → COMPLIANCE_OFFICER → GENERAL_MANAGER → publish. Creator cannot approve their own change. CEO/CMD steps deferred."
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
            New draft
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
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
              <FileText className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-[#323130]">No policies yet</p>
            <p className="max-w-sm text-xs text-[#605e5c]">
              Create a draft, submit for approval, then archive when superseded.
            </p>
          </div>
        ) : (
          <DataTable<PolicyDocument>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No policies"
            columns={[
              {
                key: 'code',
                label: 'Code',
                render: (r) => (
                  <span className="font-mono text-xs">{r.code}</span>
                ),
              },
              { key: 'title', label: 'Title' },
              {
                key: 'category',
                label: 'Category',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">{r.category}</span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'publishedAt',
                label: 'Published',
                render: (r) => (
                  <span className="text-xs">{formatDate(r.publishedAt)}</span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const status = norm(r.status);
                  const busy = busyId === r.id;
                  const isOwn =
                    !!sessionUser?.id &&
                    !!r.createdBy &&
                    r.createdBy === sessionUser.id;
                  const isSuperAdmin =
                    sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;

                  if (status === 'draft' || status === 'rejected') {
                    return (
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busy}
                        onClick={() =>
                          void act(r.id, () => submitPolicy(r.id))
                        }
                      >
                        Submit
                      </button>
                    );
                  }

                  if (status === 'pending_approval') {
                    if (isOwn && !isSuperAdmin) {
                      return (
                        <span className="text-[11px] text-[#a19f9d]">
                          Awaiting other approver
                        </span>
                      );
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busy}
                          onClick={() =>
                            void act(r.id, () => approvePolicy(r.id))
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busy}
                          onClick={() => setRejectTarget(r)}
                        >
                          Reject
                        </button>
                      </div>
                    );
                  }

                  if (status === 'published') {
                    return (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busy}
                        onClick={() =>
                          void act(r.id, () => archivePolicy(r.id))
                        }
                      >
                        Archive
                      </button>
                    );
                  }

                  return (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreatePolicyModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectPolicyModal
          policy={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={async () => {
            setRejectTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </ComplianceShell>
  );
}

function CreatePolicyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreatePolicyBody>({
    code: '',
    title: '',
    category: 'DATA_PROTECTION',
    summary: '',
    body: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPolicy({
        ...form,
        summary: form.summary?.trim() || undefined,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New policy draft" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs text-[#605e5c]">
          Code
          <input
            className={`${inputCls} mt-1`}
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="POL-…"
          />
        </label>
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
          Category
          <input
            className={`${inputCls} mt-1`}
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Summary (optional)
          <input
            className={`${inputCls} mt-1`}
            value={form.summary ?? ''}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Body
          <textarea
            className={`${inputCls} mt-1 min-h-[120px]`}
            required
            minLength={10}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Saving…' : 'Create draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectPolicyModal({
  policy,
  onClose,
  onRejected,
}: {
  policy: PolicyDocument;
  onClose: () => void;
  onRejected: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await rejectPolicy(policy.id, reason);
      await onRejected();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reject ${policy.code}`} onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs text-[#605e5c]">
          Reason
          <textarea
            className={`${inputCls} mt-1 min-h-[80px]`}
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
