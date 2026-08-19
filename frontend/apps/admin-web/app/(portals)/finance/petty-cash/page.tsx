'use client';

import {
  approvePettyCashVoucher,
  getDocumentDownloadUrl,
  issuePettyCashVoucher,
  listDocuments,
  listPettyCashFunds,
  listPettyCashVouchers,
  rejectPettyCashVoucher,
  reimbursePettyCashVoucher,
  uploadDocument,
  type DocumentObject,
  type PettyCashFund,
  type PettyCashVoucher,
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
  Banknote,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  PettyCashEmpty,
  PettyCashRoster,
} from '../_components/PettyCashRoster';

type StatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'APPROVED'
  | 'ISSUED'
  | 'REIMBURSED'
  | 'REJECTED';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'ISSUED', label: 'Issued' },
  { id: 'REIMBURSED', label: 'Retired' },
  { id: 'REJECTED', label: 'Rejected' },
];

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
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PettyCashVoucher | null>(
    null,
  );
  const [issueTarget, setIssueTarget] = useState<PettyCashVoucher | null>(null);
  const [reimburseTarget, setReimburseTarget] =
    useState<PettyCashVoucher | null>(null);
  const [receiptsTarget, setReceiptsTarget] =
    useState<PettyCashVoucher | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const sessionUser = useMemo(() => getSessionUser(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vouchers, fundRows] = await Promise.all([
        listPettyCashVouchers(),
        listPettyCashFunds(),
      ]);
      setRows(vouchers);
      setFunds(fundRows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const imprestBalance = useMemo(
    () => funds.reduce((sum, f) => sum + Number(f.currentBalance ?? 0), 0),
    [funds],
  );

  const counts = useMemo(() => {
    const c = {
      ALL: rows.length,
      PENDING: 0,
      APPROVED: 0,
      ISSUED: 0,
      REIMBURSED: 0,
      REJECTED: 0,
      pendingAmount: 0,
      issuedAmount: 0,
      reimbursedAmount: 0,
    };
    for (const r of rows) {
      if (r.status === 'PENDING') {
        c.PENDING += 1;
        c.pendingAmount += r.amount;
      } else if (r.status === 'APPROVED') c.APPROVED += 1;
      else if (r.status === 'ISSUED') {
        c.ISSUED += 1;
        c.issuedAmount += r.amount;
      } else if (r.status === 'REIMBURSED') {
        c.REIMBURSED += 1;
        c.reimbursedAmount += r.amount;
      } else if (r.status === 'REJECTED') c.REJECTED += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.voucherNumber.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.branchCode ?? '').toLowerCase().includes(q) ||
        (r.branchName ?? '').toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Petty cash</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Request → approve → issue cash (debits imprest) → retire with receipt.
            No petty cash is issued without approval. Creator cannot approve, issue,
            or retire their own voucher.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Link href="/ess/petty-cash" className={btnSecondary}>
              ESS apply
            </Link>
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
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Imprest balance"
          value={formatMoney(imprestBalance)}
          hint={
            funds[0]?.name
              ? `${funds.length} fund${funds.length === 1 ? '' : 's'} · ${funds[0].name}`
              : 'Active petty cash funds'
          }
          accent="blue"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Pending approval"
          value={counts.PENDING}
          hint={
            counts.pendingAmount > 0
              ? formatMoney(counts.pendingAmount)
              : 'Creator ≠ approver'
          }
          accent="amber"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Approved"
          value={counts.APPROVED}
          hint="Ready to issue — not yet debited"
          accent="sky"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Issued"
          value={counts.ISSUED}
          hint={
            counts.issuedAmount > 0
              ? `${formatMoney(counts.issuedAmount)} outstanding`
              : 'Cash out, awaiting receipt'
          }
          accent="violet"
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          label="Retired"
          value={formatMoney(counts.reimbursedAmount)}
          hint={`${counts.REIMBURSED} closed with receipt`}
          accent="emerald"
          icon={<Wallet className="h-5 w-5" />}
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
            <Wallet className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Voucher register
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Approve · issue cash (debits balance) · attach MinIO receipt · retire
            · ESS requests land here
          </p>
        </div>
      </div>

      <PettyCashRoster
        rows={filtered}
        loading={loading}
        busyId={busyId}
        onApprove={(r) => void onApprove(r)}
        onReject={setRejectTarget}
        onIssue={setIssueTarget}
        onReimburse={setReimburseTarget}
        onReceipts={setReceiptsTarget}
        canAct={(r) => {
          const isOwn =
            !!sessionUser?.id && r.createdBy === sessionUser.id;
          if (
            r.status === 'PENDING' ||
            r.status === 'APPROVED' ||
            r.status === 'ISSUED'
          ) {
            if (isOwn) return 'own';
            return true;
          }
          return false;
        }}
        toolbar={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search voucher #, purpose, branch, department…"
                className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
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
          <PettyCashEmpty
            title={rows.length === 0 ? 'No vouchers yet' : 'No matches'}
            description={
              rows.length === 0
                ? 'Employees request via ESS. Approve here, issue cash (creator ≠ issuer), then retire with a receipt.'
                : 'Try another search or status filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} vouchers
        </p>
      ) : null}

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

      {issueTarget ? (
        <IssueModal
          voucher={issueTarget}
          onClose={() => setIssueTarget(null)}
          onIssued={async () => {
            setIssueTarget(null);
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

function IssueModal({
  voucher,
  onClose,
  onIssued,
}: {
  voucher: PettyCashVoucher;
  onClose: () => void;
  onIssued: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issuePettyCashVoucher(voucher.id);
      await onIssued();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Issue cash — ${voucher.voucherNumber}`}
      description="Debits the imprest fund. No petty cash is issued without approval. The requester cannot issue their own voucher."
      onClose={onClose}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <p className="text-sm text-[#605e5c]">
          Amount {formatMoney(voucher.amount)} · {voucher.purpose}
        </p>
        <p className="text-xs text-[#8a8886]">
          {[voucher.branchCode ?? voucher.branchName, voucher.department]
            .filter(Boolean)
            .join(' · ') || 'HQ imprest'}
        </p>
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
            {submitting ? 'Issuing…' : 'Issue cash'}
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
      title={`Retire — ${voucher.voucherNumber}`}
      description="Closes the voucher after cash was issued. Imprest was already debited on issue. Attach a MinIO receipt and/or notes."
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
            {submitting ? 'Saving…' : 'Retire voucher'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
