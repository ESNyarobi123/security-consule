'use client';

import {
  createRisk,
  getRiskOptions,
  listRisks,
  updateRisk,
  type CatalogOption,
  type RiskRegisterItem,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import {
  DataTable,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Eye, RefreshCw, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError, formatDateTime } from '../_components/shared';

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
        {label}
      </p>
      <div className="mt-0.5 break-words text-[13px] text-[#1b1a19]">
        {children}
      </div>
    </div>
  );
}

export default function ComplianceRisksPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const canMutate =
    can(sessionUser, 'compliance.manage') || can(sessionUser, 'dpo.manage');
  const [rows, setRows] = useState<RiskRegisterItem[]>([]);
  const [cats, setCats] = useState<CatalogOption[]>([]);
  const [frames, setFrames] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('DATA_PROTECTION');
  const [severity, setSeverity] = useState('HIGH');
  const [regulatoryRef, setRegulatoryRef] = useState('PDPA_TANZANIA');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<RiskRegisterItem | null>(null);
  const [mitigation, setMitigation] = useState('');
  const [residualNotes, setResidualNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, opts] = await Promise.all([listRisks(), getRiskOptions()]);
      setRows(list);
      setCats(opts.categories);
      setFrames(opts.frameworks);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openDetail(row: RiskRegisterItem) {
    setDetail(row);
    setMitigation(row.mitigation ?? '');
    setResidualNotes(row.residualNotes ?? '');
  }

  async function saveDetail() {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRisk(detail.id, {
        mitigation: mitigation.trim() || null,
        residualNotes: residualNotes.trim() || null,
      });
      setDetail(updated);
      setMitigation(updated.mitigation ?? '');
      setResidualNotes(updated.residualNotes ?? '');
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }

  async function moveStatus(row: RiskRegisterItem, status: string) {
    setError(null);
    try {
      await updateRisk(row.id, { status });
      await load();
    } catch (e) {
      setError(formatApiError(e));
    }
  }

  const labelOf = (list: CatalogOption[], value?: string | null) =>
    value ? list.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ') : '—';

  return (
    <ComplianceShell
      title="Risk register"
      description="Thin §32 register with regulatory references. Not a DPIA / residual-risk scoring engine. Recorder cannot close their own row."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {canMutate ? (
        <div className="mb-4 grid gap-2 rounded-md border border-[#e1dfdd] p-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            className={inputCls + ' mt-0'}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={inputCls + ' mt-0'}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputCls + ' mt-0'}
            value={regulatoryRef}
            onChange={(e) => setRegulatoryRef(e.target.value)}
          >
            {frames.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            className={inputCls + ' mt-0 md:col-span-2'}
            placeholder="Description (min 10 chars)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || title.length < 3 || description.length < 10}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await createRisk({
                    title,
                    description,
                    category,
                    severity,
                    regulatoryRef,
                  });
                  setTitle('');
                  setDescription('');
                  await load();
                } catch (e) {
                  setError(formatApiError(e));
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Record risk
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-[#605e5c]">
          Legal / Auditor: read-only. Mutate needs compliance.manage or dpo.manage.
        </p>
      )}
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No risks recorded"
        columns={[
          { key: 'referenceCode', label: 'Ref' },
          { key: 'title', label: 'Title' },
          {
            key: 'description',
            label: 'Risk description',
            render: (r) => (
              <p
                className="max-w-[320px] truncate text-[12px] text-[#605e5c]"
                title={r.description}
              >
                {r.description || '—'}
              </p>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'regulatoryRef',
            label: 'Regulatory',
            render: (r) => r.regulatoryRef?.replace(/_/g, ' ') ?? '—',
          },
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
            key: 'id',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-[#e1dfdd] bg-white px-2 py-1 text-xs font-semibold text-[#0067b8] hover:bg-[#f3f9fd]"
                  onClick={() => openDetail(r)}
                >
                  <Eye className="h-3 w-3" />
                  Risk details
                </button>
                {canMutate
                  ? r.allowedNextStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                        onClick={() => void moveStatus(r, s)}
                      >
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))
                  : null}
              </div>
            ),
          },
        ]}
      />

      {detail ? (
        <Modal
          title={`${detail.referenceCode} · ${detail.title}`}
          description={`Recorded ${formatDateTime(detail.createdAt)} · last update ${formatDateTime(detail.updatedAt)}`}
          size="lg"
          onClose={() => setDetail(null)}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.severity} />
              <StatusBadge status={detail.status} />
              <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c] ring-1 ring-[#e1dfdd]">
                {labelOf(cats, detail.category)}
              </span>
              <span className="rounded-full bg-[#eff6fc] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {labelOf(frames, detail.regulatoryRef)}
              </span>
            </div>

            <div className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
                Risk description
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#1b1a19]">
                {detail.description || '—'}
              </p>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
                Mitigation {canMutate ? '(editable)' : ''}
              </p>
              {canMutate && detail.status !== 'CLOSED' ? (
                <textarea
                  className={inputCls + ' mt-0 min-h-[72px]'}
                  placeholder="Controls in place, owner, and target date"
                  value={mitigation}
                  onChange={(e) => setMitigation(e.target.value)}
                />
              ) : (
                <p className="whitespace-pre-wrap rounded-md border border-[#e1dfdd] bg-white px-3 py-2 text-[13px] text-[#1b1a19]">
                  {detail.mitigation || '—'}
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
                Residual notes {canMutate ? '(editable)' : ''}
              </p>
              {canMutate && detail.status !== 'CLOSED' ? (
                <textarea
                  className={inputCls + ' mt-0 min-h-[64px]'}
                  placeholder="Remaining exposure after mitigation"
                  value={residualNotes}
                  onChange={(e) => setResidualNotes(e.target.value)}
                />
              ) : (
                <p className="whitespace-pre-wrap rounded-md border border-[#e1dfdd] bg-white px-3 py-2 text-[13px] text-[#1b1a19]">
                  {detail.residualNotes || '—'}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Recorded by">
                {detail.createdByName ?? detail.createdBy?.slice(0, 8) ?? '—'}
              </DetailField>
              <DetailField label="Closed by">
                {detail.closedByName ?? '—'}
              </DetailField>
              <DetailField label="Closed at">
                {detail.closedAt ? formatDateTime(detail.closedAt) : '—'}
              </DetailField>
              <DetailField label="Severity">{detail.severity}</DetailField>
              <DetailField label="Status">{detail.status}</DetailField>
              <DetailField label="Reference">
                <span className="font-mono text-[12px]">
                  {detail.referenceCode}
                </span>
              </DetailField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edebe9] pt-3">
              <div className="flex flex-wrap gap-2">
                {canMutate && detail.status !== 'CLOSED'
                  ? detail.allowedNextStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={btnSecondary}
                        onClick={() => void moveStatus(detail, s)}
                      >
                        Move to {s.replace(/_/g, ' ')}
                      </button>
                    ))
                  : null}
              </div>
              <div className="flex items-center gap-2">
                {canMutate && detail.status !== 'CLOSED' ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={saving}
                    onClick={() => void saveDetail()}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving…' : 'Save mitigation'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setDetail(null)}
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </ComplianceShell>
  );
}
