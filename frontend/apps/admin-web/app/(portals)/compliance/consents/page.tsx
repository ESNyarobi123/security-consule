'use client';

import {
  createConsent,
  listConsentOptions,
  listConsents,
  withdrawConsent,
  type CatalogOption,
  type ConsentChannel,
  type ConsentLawfulBasis,
  type ConsentRecord,
  type ConsentSubjectType,
  type CreateConsentBody,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { FileCheck2, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import {
  formatApiError,
  formatDate,
  formatDateTime,
} from '../_components/shared';

const FALLBACK_PURPOSES: CatalogOption[] = [
  { value: 'ACCESS_CONTROL', label: 'Access control' },
  { value: 'CCTV_MONITORING', label: 'CCTV / monitoring' },
  { value: 'EMPLOYMENT_ADMIN', label: 'Employment administration' },
  { value: 'OTHER', label: 'Other' },
];

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ComplianceConsentsPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const canMutate = can(sessionUser, 'dpo.manage');
  const [rows, setRows] = useState<ConsentRecord[]>([]);
  const [catalog, setCatalog] = useState({
    purposes: FALLBACK_PURPOSES,
    subjectTypes: [] as CatalogOption[],
    lawfulBases: [] as CatalogOption[],
    channels: [] as CatalogOption[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [withdrawRow, setWithdrawRow] = useState<ConsentRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [consents, options] = await Promise.all([
        listConsents(),
        listConsentOptions().catch(() => null),
      ]);
      setRows(consents);
      if (options) {
        setCatalog({
          purposes:
            options.purposes.length > 0 ? options.purposes : FALLBACK_PURPOSES,
          subjectTypes: options.subjectTypes,
          lawfulBases: options.lawfulBases,
          channels: options.channels,
        });
      }
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
    <ComplianceShell
      title="Consent & lawful basis"
      description="DPO register of subject consent and other lawful bases for processing. Mutates require dpo.manage. Separate from ops attendance / visitor codes."
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
          {canMutate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={btnPrimary}
            >
              <Plus className="h-3.5 w-3.5" />
              Record consent
            </button>
          ) : null}
        </>
      }
    >
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        Records purpose, lawful basis, channel, and withdrawal with an audit
        trail. DPIA / backup-DR remain deferred.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
              <FileCheck2 className="h-4 w-4" />
            </span>
            <p className="text-sm text-[#605e5c]">No consent records yet</p>
          </div>
        ) : (
          <DataTable<ConsentRecord>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No consent records"
            columns={[
              {
                key: 'referenceCode',
                label: 'Ref',
                render: (r) => (
                  <span className="font-mono text-sm">{r.referenceCode}</span>
                ),
              },
              {
                key: 'subjectName',
                label: 'Subject',
                render: (r) => (
                  <div className="max-w-[180px]">
                    <p className="truncate text-sm text-[#323130]">
                      {r.subjectName}
                    </p>
                    <p className="truncate text-[11px] text-[#a19f9d]">
                      {r.subjectType}
                      {r.subjectRef ? ` · ${r.subjectRef}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'purpose',
                label: 'Purpose',
                render: (r) => (
                  <StatusBadge status={r.purpose} />
                ),
              },
              {
                key: 'lawfulBasis',
                label: 'Basis',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">{r.lawfulBasis}</span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'grantedAt',
                label: 'Granted',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {formatDate(r.grantedAt)}
                  </span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) =>
                  canMutate && r.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-[#a4262c] hover:underline disabled:opacity-50"
                      disabled={busyId === r.id}
                      onClick={() => setWithdrawRow(r)}
                    >
                      Withdraw
                    </button>
                  ) : r.withdrawnByName ? (
                    <span className="text-[11px] text-[#605e5c]">
                      by {r.withdrawnByName}
                    </span>
                  ) : null,
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateConsentModal
          catalog={catalog}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {withdrawRow ? (
        <WithdrawConsentModal
          row={withdrawRow}
          busy={busyId === withdrawRow.id}
          onClose={() => setWithdrawRow(null)}
          onConfirm={async (reason) => {
            setBusyId(withdrawRow.id);
            setError(null);
            try {
              await withdrawConsent(withdrawRow.id, reason);
              setWithdrawRow(null);
              await refresh();
            } catch (err) {
              setError(formatApiError(err));
            } finally {
              setBusyId(null);
            }
          }}
        />
      ) : null}
    </ComplianceShell>
  );
}

function CreateConsentModal({
  catalog,
  onClose,
  onCreated,
}: {
  catalog: {
    purposes: CatalogOption[];
    subjectTypes: CatalogOption[];
    lawfulBases: CatalogOption[];
    channels: CatalogOption[];
  };
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateConsentBody>({
    subjectType: (catalog.subjectTypes[0]?.value as ConsentSubjectType) ||
      'CUSTOMER_EMPLOYEE',
    subjectName: '',
    purpose: catalog.purposes[0]?.value || 'ACCESS_CONTROL',
    lawfulBasis: (catalog.lawfulBases[0]?.value as ConsentLawfulBasis) ||
      'CONSENT',
    channel: (catalog.channels[0]?.value as ConsentChannel) || 'WEB_FORM',
    grantedAt: new Date().toISOString(),
  });
  const [grantedLocal, setGrantedLocal] = useState(toLocalInput(new Date()));
  const [expiresLocal, setExpiresLocal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.subjectName.trim()) {
      setError('Subject name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createConsent({
        ...form,
        subjectName: form.subjectName.trim(),
        subjectEmail: form.subjectEmail?.trim() || undefined,
        subjectRef: form.subjectRef?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        grantedAt: new Date(grantedLocal).toISOString(),
        expiresAt: expiresLocal
          ? new Date(expiresLocal).toISOString()
          : undefined,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Record consent" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Subject type
            <select
              className={`${inputCls} mt-1`}
              value={form.subjectType}
              onChange={(e) =>
                setForm({
                  ...form,
                  subjectType: e.target.value as ConsentSubjectType,
                })
              }
            >
              {(catalog.subjectTypes.length
                ? catalog.subjectTypes
                : [{ value: 'OTHER', label: 'Other' }]
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Subject name
            <input
              className={`${inputCls} mt-1`}
              value={form.subjectName}
              onChange={(e) =>
                setForm({ ...form, subjectName: e.target.value })
              }
              required
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Email (optional)
            <input
              type="email"
              className={`${inputCls} mt-1`}
              value={form.subjectEmail ?? ''}
              onChange={(e) =>
                setForm({ ...form, subjectEmail: e.target.value })
              }
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Subject ref (optional)
            <input
              className={`${inputCls} mt-1`}
              value={form.subjectRef ?? ''}
              onChange={(e) =>
                setForm({ ...form, subjectRef: e.target.value })
              }
              placeholder="EMP-1001 / GRD-0001"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Purpose
            <select
              className={`${inputCls} mt-1`}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            >
              {catalog.purposes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Lawful basis
            <select
              className={`${inputCls} mt-1`}
              value={form.lawfulBasis}
              onChange={(e) =>
                setForm({
                  ...form,
                  lawfulBasis: e.target.value as ConsentLawfulBasis,
                })
              }
            >
              {(catalog.lawfulBases.length
                ? catalog.lawfulBases
                : [{ value: 'CONSENT', label: 'Consent' }]
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Channel
            <select
              className={`${inputCls} mt-1`}
              value={form.channel}
              onChange={(e) =>
                setForm({
                  ...form,
                  channel: e.target.value as ConsentChannel,
                })
              }
            >
              {(catalog.channels.length
                ? catalog.channels
                : [{ value: 'WEB_FORM', label: 'Web form' }]
              ).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Granted at
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={grantedLocal}
              onChange={(e) => setGrantedLocal(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-[#605e5c]">
          Expires at (optional)
          <input
            type="datetime-local"
            className={`${inputCls} mt-1`}
            value={expiresLocal}
            onChange={(e) => setExpiresLocal(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Notes
          <textarea
            className={`${inputCls} mt-1 min-h-[72px]`}
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function WithdrawConsentModal({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: ConsentRecord;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError('Withdrawal reason is required (min 5 characters)');
      return;
    }
    setError(null);
    await onConfirm(reason.trim());
  }

  return (
    <Modal title={`Withdraw ${row.referenceCode}`} onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Subject: {row.subjectName} · {row.purpose}. Withdrawal is audited and
          irreversible on this record.
        </p>
        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Reason
          <textarea
            className={`${inputCls} mt-1 min-h-[72px]`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        <p className="text-[11px] text-[#a19f9d]">
          Granted {formatDateTime(row.grantedAt)}
          {row.expiresAt ? ` · expires ${formatDateTime(row.expiresAt)}` : ''}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Withdrawing…' : 'Confirm withdrawal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
