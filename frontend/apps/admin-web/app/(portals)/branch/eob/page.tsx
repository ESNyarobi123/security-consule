'use client';

import {
  approveOccurrenceEntry,
  correctOccurrenceEntry,
  createOccurrenceEntry,
  getDocumentDownloadUrl,
  getOccurrenceHistory,
  listDocuments,
  listOccurrenceEntries,
  listSites,
  uploadDocument,
  type DocumentObject,
  type OccurrenceEntry,
  type OccurrenceHistoryVersion,
  type Site,
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
import {
  BookOpen,
  CheckCircle2,
  History,
  Paperclip,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  formatApiError,
  formatDateTime,
  shortId,
} from '../_components/shared';

const CATEGORIES = [
  'ROUTINE',
  'VISITOR_ISSUE',
  'INCIDENT',
  'EQUIPMENT',
  'SECURITY_NOTE',
  'OTHER',
] as const;

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BranchEobPage() {
  const [rows, setRows] = useState<OccurrenceEntry[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [correctRow, setCorrectRow] = useState<OccurrenceEntry | null>(null);
  const [historyRow, setHistoryRow] = useState<OccurrenceEntry | null>(null);
  const [attachRow, setAttachRow] = useState<OccurrenceEntry | null>(null);
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entries, s] = await Promise.all([
        listOccurrenceEntries(siteId ? { siteId } : undefined),
        listSites(),
      ]);
      setRows(entries);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const siteLabel = (row: OccurrenceEntry) => {
    if (row.siteCode) return row.siteCode;
    const s = sites.find((x) => x.id === row.siteId);
    return s ? s.code : shortId(row.siteId);
  };

  async function onApprove(row: OccurrenceEntry) {
    setApprovingId(row.id);
    setActionError(null);
    try {
      await approveOccurrenceEntry(row.id);
      await refresh();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <BranchShell
      title="Electronic Occurrence Book"
      description="Append-only site log for Branch Ops. Create, correct with a reason, or second-person approve — recorder ≠ approver (operations.manage)."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Site
            <select
              className={`${inputCls} !py-1`}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
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
            New entry
          </button>
        </>
      }
    >
      <p className="mb-3 rounded border border-[#c7e0f4] bg-[#eff6fc] px-3 py-2 text-xs text-[#004578]">
        Thin EOB: create, list, correct, history, second-person approve, and
        evidence attachments (pdf/png/jpeg/webp via MinIO — documents.manage).
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {actionError}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <BookOpen className="h-5 w-5 text-[#a19f9d]" />
            <p>No occurrence book entries</p>
          </div>
        ) : (
          <DataTable<OccurrenceEntry>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No occurrence book entries"
            columns={[
              {
                key: 'recordedAt',
                label: 'Recorded',
                render: (r) => formatDateTime(r.recordedAt),
              },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r),
              },
              {
                key: 'category',
                label: 'Category',
                render: (r) => <StatusBadge status={r.category} />,
              },
              {
                key: 'description',
                label: 'Narrative',
                render: (r) => (
                  <span className="line-clamp-2 max-w-md text-[#323130]">
                    {r.description}
                  </span>
                ),
              },
              {
                key: 'version',
                label: 'Ver',
                render: (r) => (
                  <span className="tabular-nums text-[#605e5c]">
                    v{r.version}
                    {r.correctionReason ? (
                      <span
                        className="ml-1 text-[10px] text-[#876400]"
                        title={r.correctionReason}
                      >
                        corrected
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: 'approvedBy',
                label: 'Approval',
                render: (r) =>
                  r.approvedBy ? (
                    <span className="text-[11px] text-[#107c10]">
                      Approved
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#876400]">
                      Pending
                    </span>
                  ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const isOwnOfficer =
                    !!sessionUser?.id &&
                    !!r.officerId &&
                    r.officerId === sessionUser.id;
                  const needsApprove = !r.approvedBy;
                  return (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:underline"
                        onClick={() => setAttachRow(r)}
                      >
                        <Paperclip className="h-3 w-3" />
                        Attachments
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0078d4] hover:underline"
                        onClick={() => setHistoryRow(r)}
                      >
                        <History className="h-3 w-3" />
                        History
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-[#0078d4] hover:underline"
                        onClick={() => setCorrectRow(r)}
                      >
                        Correct
                      </button>
                      {needsApprove ? (
                        isOwnOfficer ? (
                          <span className="text-[11px] text-[#a19f9d]">
                            Awaiting other approver
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#107c10] hover:underline disabled:opacity-50"
                            disabled={approvingId === r.id}
                            onClick={() => void onApprove(r)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {approvingId === r.id ? 'Approving…' : 'Approve'}
                          </button>
                        )
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateEobModal
          sites={sites}
          defaultSiteId={siteId || sites[0]?.id || ''}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {correctRow ? (
        <CorrectEobModal
          entry={correctRow}
          onClose={() => setCorrectRow(null)}
          onCorrected={async () => {
            setCorrectRow(null);
            await refresh();
          }}
        />
      ) : null}

      {historyRow ? (
        <HistoryEobModal
          entry={historyRow}
          onClose={() => setHistoryRow(null)}
        />
      ) : null}

      {attachRow ? (
        <AttachmentsEobModal
          entry={attachRow}
          onClose={() => setAttachRow(null)}
        />
      ) : null}
    </BranchShell>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsEobModal({
  entry,
  onClose,
}: {
  entry: OccurrenceEntry;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDocuments({
        resourceType: 'OccurrenceEntry',
        resourceId: entry.id,
      });
      setDocs(rows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [entry.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a file (pdf, png, jpeg, or webp — max 10MB)');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        resourceType: 'OccurrenceEntry',
        resourceId: entry.id,
      });
      setFile(null);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(doc: DocumentObject) {
    setError(null);
    try {
      const { url } = await getDocumentDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <Modal title="EOB attachments" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Evidence files for entry {shortId(entry.id)} (org-scoped MinIO
          objects). Allowed: pdf / png / jpeg / webp · max 10MB.
        </p>
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(e) => void onUpload(e)}
          className="flex flex-wrap items-end gap-2 rounded border border-[#edebe9] bg-[#faf9f8] px-3 py-2"
        >
          <label className="block min-w-[200px] flex-1 text-xs text-[#605e5c]">
            File
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className={`${inputCls} mt-1`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            className={btnPrimary}
            disabled={uploading || !file}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        {loading ? (
          <p className="text-xs text-[#605e5c]">Loading attachments…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-[#605e5c]">No attachments yet.</p>
        ) : (
          <ul className="divide-y divide-[#edebe9] rounded border border-[#edebe9]">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-[#323130]">{d.fileName}</p>
                  <p className="text-[11px] text-[#605e5c]">
                    {d.contentType} · {formatBytes(d.sizeBytes)} ·{' '}
                    {formatDateTime(d.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-[#0078d4] hover:underline"
                  onClick={() => void onDownload(d)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateEobModal({
  sites,
  defaultSiteId,
  onClose,
  onCreated,
}: {
  sites: Site[];
  defaultSiteId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [recordedAt, setRecordedAt] = useState(toLocalInput(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId) {
      setError('Select a site');
      return;
    }
    if (!description.trim()) {
      setError('Narrative is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createOccurrenceEntry({
        siteId,
        category: category.trim(),
        description: description.trim(),
        recordedAt: new Date(recordedAt).toISOString(),
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New occurrence entry" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            <option value="" disabled>
              Select site
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#605e5c]">
          Category
          <select
            className={`${inputCls} mt-1`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#605e5c]">
          Recorded at
          <input
            type="datetime-local"
            className={`${inputCls} mt-1`}
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Narrative
          <textarea
            className={`${inputCls} mt-1 min-h-[96px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, who was involved, actions taken…"
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Append entry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryEobModal({
  entry,
  onClose,
}: {
  entry: OccurrenceEntry;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<OccurrenceHistoryVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getOccurrenceHistory(entry.id)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(formatApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  return (
    <Modal title="Occurrence version history" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Append-only lineage for this entry (v1 original → corrections). Second
          person must approve the current version.
        </p>
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-xs text-[#605e5c]">Loading history…</p>
        ) : (
          <ol className="relative space-y-0 border-l border-[#c7e0f4] pl-4">
            {versions.map((v) => (
              <li key={v.id} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                    v.isCurrent
                      ? 'border-[#0078d4] bg-[#0078d4]'
                      : 'border-[#a19f9d] bg-white'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#323130]">
                    v{v.version}
                  </span>
                  <StatusBadge status={v.category} />
                  {v.isCurrent ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#0078d4]">
                      Current
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#876400]">
                      Superseded
                    </span>
                  )}
                  {v.approvedBy ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#107c10]">
                      Approved
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#876400]">
                      Pending approval
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#605e5c]">
                  {formatDateTime(v.createdAt)}
                  {v.officerId ? ` · officer ${shortId(v.officerId)}` : ''}
                </p>
                <p className="mt-1 text-sm text-[#323130] whitespace-pre-wrap">
                  {v.description}
                </p>
                {v.correctionReason ? (
                  <p className="mt-1 rounded border border-[#fff4ce] bg-[#fff8e1] px-2 py-1 text-xs text-[#876400]">
                    Reason: {v.correctionReason}
                  </p>
                ) : v.version === 1 ? (
                  <p className="mt-1 text-[11px] text-[#a19f9d]">
                    Original entry
                  </p>
                ) : null}
                {v.approvedBy ? (
                  <p className="mt-1 text-[11px] text-[#605e5c]">
                    Approved by {shortId(v.approvedBy)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {!loading && !error && versions.length === 0 ? (
          <p className="text-xs text-[#605e5c]">No versions found.</p>
        ) : null}
        <div className="flex justify-end pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CorrectEobModal({
  entry,
  onClose,
  onCorrected,
}: {
  entry: OccurrenceEntry;
  onClose: () => void;
  onCorrected: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(entry.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Correction reason is required');
      return;
    }
    if (!description.trim()) {
      setError('Corrected narrative is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await correctOccurrenceEntry(entry.id, {
        reason: reason.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
      });
      await onCorrected();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Correct occurrence entry" onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Append-only: the original stays on record (non-current). A new version
          is created with your reason (pending second-person approval).
        </p>
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs text-[#605e5c]">
          Category
          <select
            className={`${inputCls} mt-1`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              ...new Set([entry.category, ...CATEGORIES]),
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#605e5c]">
          Corrected narrative
          <textarea
            className={`${inputCls} mt-1 min-h-[96px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-[#605e5c]">
          Reason for correction
          <textarea
            className={`${inputCls} mt-1 min-h-[64px]`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this correction is needed…"
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Submit correction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
