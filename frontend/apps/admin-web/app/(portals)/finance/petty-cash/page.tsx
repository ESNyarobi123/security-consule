'use client';

import {
  approvePettyCashVoucher,
  getDocumentDownloadUrl,
  listDocuments,
  listPettyCashVouchers,
  rejectPettyCashVoucher,
  reimbursePettyCashVoucher,
  uploadDocument,
  type DocumentObject,
  type PettyCashVoucher,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  DataTable,
  GlassCard,
  Modal,
  PageHeader,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Paperclip, RefreshCw, Wallet } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REIMBURSED' | 'REJECTED';

const RESOURCE_TYPE = 'PettyCashVoucher';
const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';

function formatMoney(amount: number) {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `TZS ${amount.toLocaleString()}`;
  }
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

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export default function FinancePettyCashPage() {
  const [rows, setRows] = useState<PettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PettyCashVoucher | null>(
    null,
  );
  const [reimburseTarget, setReimburseTarget] =
    useState<PettyCashVoucher | null>(null);
  const [receiptsTarget, setReceiptsTarget] =
    useState<PettyCashVoucher | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const sessionUser = useMemo(() => getSessionUser(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPettyCashVouchers());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REIMBURSED: 0, REJECTED: 0 };
    for (const r of rows) {
      if (r.status in c) c[r.status as keyof typeof c] += 1;
    }
    return c;
  }, [rows]);

  async function onApprove(row: PettyCashVoucher) {
    if (sessionUser?.id && row.createdBy === sessionUser.id) {
      setError('Creator cannot approve their own petty cash request');
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await approvePettyCashVoucher(row.id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: `All (${rows.length})` },
    { id: 'PENDING', label: `Pending (${counts.PENDING})` },
    { id: 'APPROVED', label: `Approved (${counts.APPROVED})` },
    { id: 'REIMBURSED', label: `Reimbursed (${counts.REIMBURSED})` },
    { id: 'REJECTED', label: `Rejected (${counts.REJECTED})` },
  ];

  return (
    <>
      <PageHeader
        title="Petty cash"
        description="Approve requests, then mark reimbursed with a MinIO receipt (pdf/png/jpeg/webp), URL, or notes. Employees apply via ESS."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        }
      />

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={
              filter === t.id ? btnPrimary : `${btnSecondary} !text-xs`
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        {filtered.length === 0 && !loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-[#605e5c]">
            <Wallet className="h-4 w-4" />
            No petty cash vouchers in this view.
          </div>
        ) : (
          <DataTable<PettyCashVoucher>
            loading={loading}
            keyField="id"
            rows={filtered}
            emptyMessage="No vouchers"
            columns={[
              {
                key: 'voucherNumber',
                label: 'Voucher #',
                render: (r) => (
                  <span className="font-mono text-sm">{r.voucherNumber}</span>
                ),
              },
              {
                key: 'amount',
                label: 'Amount',
                render: (r) => formatMoney(r.amount),
              },
              {
                key: 'category',
                label: 'Category',
                render: (r) => <span className="text-xs">{r.category}</span>,
              },
              {
                key: 'purpose',
                label: 'Purpose',
                render: (r) => (
                  <span
                    className="max-w-[200px] truncate text-xs text-[#605e5c]"
                    title={r.purpose}
                  >
                    {r.purpose}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={r.status} />
                    {r.status === 'REIMBURSED' && r.reimbursedAt ? (
                      <span className="text-[10px] text-[#605e5c]">
                        {formatDateTime(r.reimbursedAt)}
                      </span>
                    ) : null}
                    {r.receiptUrl ? (
                      <span
                        className="max-w-[140px] truncate text-[10px] text-[#0078d4]"
                        title={r.receiptUrl}
                      >
                        {r.receiptUrl.startsWith('document:')
                          ? 'MinIO receipt'
                          : 'Receipt ref'}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'createdAt',
                label: 'Submitted',
                render: (r) => formatDate(r.createdAt),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  if (r.status === 'PENDING') {
                    const isOwn =
                      !!sessionUser?.id && r.createdBy === sessionUser.id;
                    return (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id || isOwn}
                          title={
                            isOwn
                              ? 'Creator cannot approve own request'
                              : 'Approve'
                          }
                          onClick={() => void onApprove(r)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busyId === r.id || isOwn}
                          onClick={() => setRejectTarget(r)}
                        >
                          Reject
                        </button>
                      </div>
                    );
                  }
                  if (r.status === 'APPROVED') {
                    const isOwn =
                      !!sessionUser?.id && r.createdBy === sessionUser.id;
                    return (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={btnSecondary}
                          onClick={() => setReceiptsTarget(r)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Receipts
                        </button>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id || isOwn}
                          title={
                            isOwn
                              ? 'Creator cannot mark own voucher reimbursed'
                              : 'Mark reimbursed'
                          }
                          onClick={() => setReimburseTarget(r)}
                        >
                          Mark reimbursed
                        </button>
                      </div>
                    );
                  }
                  if (r.status === 'REIMBURSED') {
                    return (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => setReceiptsTarget(r)}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        Receipts
                      </button>
                    );
                  }
                  return null;
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {rejectTarget ? (
        <RejectModal
          voucher={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={async () => {
            setRejectTarget(null);
            await load();
          }}
        />
      ) : null}

      {reimburseTarget ? (
        <ReimburseModal
          voucher={reimburseTarget}
          onClose={() => setReimburseTarget(null)}
          onDone={async () => {
            setReimburseTarget(null);
            await load();
          }}
        />
      ) : null}

      {receiptsTarget ? (
        <ReceiptsModal
          voucher={receiptsTarget}
          onClose={() => setReceiptsTarget(null)}
        />
      ) : null}
    </>
  );
}

function RejectModal({
  voucher,
  onClose,
  onRejected,
}: {
  voucher: PettyCashVoucher;
  onClose: () => void;
  onRejected: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await rejectPettyCashVoucher(voucher.id, reason.trim());
      await onRejected();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Reject ${voucher.voucherNumber}`}
      description="Fund balance is unchanged on reject."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            required
            minLength={3}
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiptsModal({
  voucher,
  onClose,
}: {
  voucher: PettyCashVoucher;
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
        resourceType: RESOURCE_TYPE,
        resourceId: voucher.id,
      });
      setDocs(rows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [voucher.id]);

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
        resourceType: RESOURCE_TYPE,
        resourceId: voucher.id,
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
    <Modal title={`Receipts — ${voucher.voucherNumber}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          MinIO receipt files for voucher {shortId(voucher.id)} (needs
          documents.manage + finance.manage). Allowed: pdf / png / jpeg / webp ·
          max 10MB.
          {voucher.receiptUrl ? (
            <>
              {' '}
              Stored ref:{' '}
              <span className="font-mono text-[11px] text-[#323130]">
                {voucher.receiptUrl}
              </span>
            </>
          ) : null}
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
              accept={ACCEPT}
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
          <p className="text-xs text-[#605e5c]">Loading receipts…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-[#605e5c]">No receipt files yet.</p>
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

function ReimburseModal({
  voucher,
  onClose,
  onDone,
}: {
  voucher: PettyCashVoucher;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [receiptUrl, setReceiptUrl] = useState(voucher.receiptUrl ?? '');
  const [notes, setNotes] = useState('');
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const rows = await listDocuments({
        resourceType: RESOURCE_TYPE,
        resourceId: voucher.id,
      });
      setDocs(rows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDocsLoading(false);
    }
  }, [voucher.id]);

  useEffect(() => {
    void refreshDocs();
  }, [refreshDocs]);

  async function onUploadFile() {
    if (!file) {
      setError('Choose a receipt file first');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument({
        file,
        resourceType: RESOURCE_TYPE,
        resourceId: voucher.id,
      });
      setFile(null);
      if (!receiptUrl.trim()) {
        setReceiptUrl(`document:${doc.id}`);
      }
      await refreshDocs();
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    let url = receiptUrl.trim();
    const note = notes.trim();
    if (!url && docs.length > 0) {
      url = `document:${docs[0].id}`;
    }
    if (!url && !note) {
      setError('Upload a MinIO receipt, or provide a receipt URL / notes');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reimbursePettyCashVoucher(voucher.id, {
        ...(url ? { receiptUrl: url } : {}),
        ...(note ? { notes: note } : {}),
      });
      await onDone();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Mark reimbursed — ${voucher.voucherNumber}`}
      description="Closes the retire/receipt loop. Imprest was already debited on approve. Attach a MinIO file and/or notes."
      onClose={onClose}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <p className="text-sm text-[#605e5c]">
          Amount {formatMoney(voucher.amount)} · {voucher.purpose}
        </p>

        <div className="space-y-2 rounded border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
          <p className="text-xs font-medium text-[#323130]">
            Receipt file (MinIO)
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1 text-xs text-[#605e5c]">
              File
              <input
                type="file"
                accept={ACCEPT}
                className={`${inputCls} mt-1`}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className={btnSecondary}
              disabled={uploading || !file}
              onClick={() => void onUploadFile()}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {docsLoading ? (
            <p className="text-[11px] text-[#605e5c]">Loading attachments…</p>
          ) : docs.length === 0 ? (
            <p className="text-[11px] text-[#605e5c]">No files attached yet.</p>
          ) : (
            <ul className="divide-y divide-[#edebe9] rounded border border-[#edebe9] bg-white">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-xs"
                >
                  <span className="font-medium text-[#323130]">
                    {d.fileName}
                  </span>
                  <button
                    type="button"
                    className="font-medium text-[#0078d4] hover:underline"
                    onClick={() => void onDownload(d)}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block text-sm font-medium text-[#323130]">
          Receipt URL / ref
          <input
            type="text"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            className={inputCls}
            placeholder="Auto-filled as document:… after upload, or paste URL"
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Receipt number, cashier, paper ref…"
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Saving…' : 'Mark reimbursed'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
