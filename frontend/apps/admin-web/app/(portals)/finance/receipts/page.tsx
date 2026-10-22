'use client';

import {
  createFinanceReceipt,
  getDocumentDownloadUrl,
  listCustomers,
  listDocuments,
  listFinanceReceipts,
  listInvoices,
  uploadDocument,
  type Customer,
  type DocumentObject,
  type FinanceReceipt,
  type Invoice,
  type ReceiptPayerType,
} from '@pssms/api-client';
import {
  Modal,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Banknote,
  FileCheck2,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const RESOURCE_TYPE = 'FinanceReceipt';
const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';

const PAYER_TYPES: { value: ReceiptPayerType; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'OTHER', label: 'Other' },
];

const METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'MOBILE_MONEY',
  'CHEQUE',
  'OTHER',
] as const;

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile money',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

function money(amount: number, currency = 'TZS') {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: currency || 'TZS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceReceiptsPage() {
  const [rows, setRows] = useState<FinanceReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [docsTarget, setDocsTarget] = useState<FinanceReceipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [receipts, customerRows, invoiceRows] = await Promise.all([
        listFinanceReceipts({
          from: from || undefined,
          to: to || undefined,
          take: 200,
        }),
        listCustomers().catch(() => [] as Customer[]),
        listInvoices().catch(() => [] as Invoice[]),
      ]);
      setRows(receipts);
      setCustomers(customerRows);
      setInvoices(invoiceRows);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.receiptNumber,
        r.payerName,
        r.payerType,
        r.invoiceNumber ?? '',
        r.paymentReference ?? '',
        r.notes ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const cash = rows
      .filter((r) => r.paymentMethod === 'CASH')
      .reduce((s, r) => s + r.amount, 0);
    const withScan = rows.filter((r) => (r.attachmentCount ?? 0) > 0).length;
    return { total, cash, withScan, count: rows.length };
  }, [rows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Receipts</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Record what was received (payer, amount, method, date) then attach the
            scanned receipt. Linking an invoice also records the invoice payment so
            AR stays correct. Money in is auditable — receipts are never edited,
            only added.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New receipt
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receipts in period"
          value={stats.count}
          hint="Recorded receipts"
          accent="blue"
          icon={<FileCheck2 className="h-5 w-5" />}
        />
        <StatCard
          label="Total received"
          value={money(stats.total)}
          hint="All payment methods"
          accent="emerald"
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          label="Cash received"
          value={money(stats.cash)}
          hint="Counter / cash receipts"
          accent="amber"
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          label="With scan attached"
          value={stats.withScan}
          hint={`${stats.count - stats.withScan} without a file`}
          accent="violet"
          icon={<Paperclip className="h-5 w-5" />}
        />
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-[#e1dfdd] bg-white p-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded border border-[#e1dfdd] bg-white px-2.5 py-1.5 focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
          <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt #, payer, invoice, reference…"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
          />
        </label>
        <label className="text-[11px] font-medium text-[#605e5c]">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${inputCls} mt-0.5`}
          />
        </label>
        <label className="text-[11px] font-medium text-[#605e5c]">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${inputCls} mt-0.5`}
          />
        </label>
        {from || to ? (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
            <tr>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Payer</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Scan</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={8}>
                  Loading receipts…
                </td>
              </tr>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={8}>
                  {rows.length === 0
                    ? 'No receipts yet. Use “New receipt” to capture one and attach the scan.'
                    : 'No receipts match this search or period.'}
                </td>
              </tr>
            ) : null}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-[#edebe9]">
                <td className="px-3 py-2 font-medium">{r.receiptNumber}</td>
                <td className="px-3 py-2 text-xs text-[#605e5c]">
                  {fmtDate(r.receivedAt)}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-[#1b1a19]">{r.payerName}</p>
                  <p className="text-[11px] text-[#8a8886]">
                    {r.payerType}
                    {r.customerName ? ` · ${r.customerName}` : ''}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs text-[#605e5c]">
                  {r.invoiceNumber ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs text-[#605e5c]">
                  {METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod}
                  {r.paymentReference ? (
                    <span className="block font-mono text-[10px] text-[#a19f9d]">
                      {r.paymentReference}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(r.amount, r.currency)}
                </td>
                <td className="px-3 py-2">
                  {(r.attachmentCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <Paperclip className="h-3 w-3" />
                      {r.attachmentCount}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">None</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs font-medium text-[#0078d4] hover:underline"
                    onClick={() => setDocsTarget(r)}
                  >
                    Receipt file
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreateReceiptModal
          customers={customers}
          invoices={invoices}
          customerById={customerById}
          onClose={() => setCreateOpen(false)}
          onCreated={async (created) => {
            setCreateOpen(false);
            await load();
            setDocsTarget(created);
          }}
        />
      ) : null}

      {docsTarget ? (
        <ReceiptDocsModal
          receipt={docsTarget}
          onClose={() => setDocsTarget(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </>
  );
}

function CreateReceiptModal({
  customers,
  invoices,
  customerById,
  onClose,
  onCreated,
}: {
  customers: Customer[];
  invoices: Invoice[];
  customerById: Map<string, Customer>;
  onClose: () => void;
  onCreated: (receipt: FinanceReceipt) => Promise<void>;
}) {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [payerType, setPayerType] = useState<ReceiptPayerType>('CUSTOMER');
  const [payerName, setPayerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [receivedAt, setReceivedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openInvoices = useMemo(
    () =>
      invoices
        .filter(
          (i) =>
            !['PAID', 'CLOSED', 'VOIDED', 'DRAFT'].includes(
              i.status.toUpperCase(),
            ),
        )
        .sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber)),
    [invoices],
  );

  function onPickInvoice(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    setCustomerId(inv.customerId);
    setPayerType('CUSTOMER');
    const customer = customerById.get(inv.customerId);
    if (customer) {
      setPayerName(customer.name);
      setCurrency(inv.currency || 'TZS');
      const balance = Math.max(inv.totalAmount - (inv.amountPaid ?? 0), 0);
      setAmount(balance > 0 ? String(balance) : String(inv.totalAmount));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!payerName.trim()) {
      setError('Payer name is required');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createFinanceReceipt({
        receiptNumber: receiptNumber.trim() || undefined,
        payerType,
        payerName: payerName.trim(),
        customerId: customerId || undefined,
        invoiceId: invoiceId || undefined,
        amount: n,
        currency,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      if (file) {
        try {
          await uploadDocument({
            file,
            resourceType: RESOURCE_TYPE,
            resourceId: created.id,
          });
        } catch (uploadErr) {
          // Receipt is recorded; surface the attachment problem in the docs modal.
          setError(
            `Receipt ${created.receiptNumber} saved, but the scan failed to upload: ${errText(
              uploadErr,
            )}`,
          );
        }
      }
      await onCreated(created);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New receipt"
      description="Record the receipt details first, then attach the scanned receipt (pdf / png / jpeg / webp · max 5MB)."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Receipt number (optional)
            <input
              className={inputCls}
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="Auto: RCP-00001"
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Received date
            <input
              type="date"
              className={inputCls}
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Payer type
            <select
              className={inputCls}
              value={payerType}
              onChange={(e) => setPayerType(e.target.value as ReceiptPayerType)}
            >
              {PAYER_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Payer name
            <input
              className={inputCls}
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Who paid"
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Customer (optional)
            <select
              className={inputCls}
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const c = customers.find((x) => x.id === e.target.value);
                if (c) setPayerName(c.name);
              }}
            >
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Apply to invoice (optional)
            <select
              className={inputCls}
              value={invoiceId}
              onChange={(e) => onPickInvoice(e.target.value)}
            >
              <option value="">— no invoice —</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} · {money(i.totalAmount, i.currency)} ·{' '}
                  {i.status}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] font-normal text-[#8a8886]">
              Linking records an invoice payment so outstanding AR updates.
            </span>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Amount
            <input
              type="number"
              min={0.01}
              step="0.01"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Currency
            <select
              className={inputCls}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {['TZS', 'USD', 'EUR', 'KES'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Payment method
            <select
              className={inputCls}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Reference (bank / mobile / cheque)
            <input
              className={inputCls}
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="CRDB-TXN-88231"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-[#605e5c]">
          Notes
          <textarea
            className={`${inputCls} min-h-[64px]`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cashier, counter receipt, purpose…"
          />
        </label>

        <label className="block rounded-lg border border-dashed border-[#c8c6c4] bg-[#faf9f8] px-3 py-2 text-xs font-medium text-[#605e5c]">
          Attach scanned receipt (optional now — can upload after saving)
          <input
            type="file"
            accept={ACCEPT}
            className={`${inputCls} mt-1`}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {error ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Saving…' : 'Record receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiptDocsModal({
  receipt,
  onClose,
  onChanged,
}: {
  receipt: FinanceReceipt;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [docs, setDocs] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(
        await listDocuments({
          resourceType: RESOURCE_TYPE,
          resourceId: receipt.id,
        }),
      );
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, [receipt.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a file (pdf, png, jpeg, or webp — max 5MB)');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        resourceType: RESOURCE_TYPE,
        resourceId: receipt.id,
      });
      setFile(null);
      await refresh();
      onChanged();
    } catch (err) {
      setError(errText(err));
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
      setError(errText(err));
    }
  }

  return (
    <Modal
      title={`Receipt file — ${receipt.receiptNumber}`}
      description={`${receipt.payerName} · ${money(
        receipt.amount,
        receipt.currency,
      )} · ${fmtDate(receipt.receivedAt)}`}
      onClose={onClose}
    >
      <div className="space-y-3">
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
            Receipt scan
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
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>

        {loading ? (
          <p className="text-xs text-[#605e5c]">Loading files…</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-[#605e5c]">
            No scan attached yet. Upload the paper receipt so the money-in trail is
            auditable.
          </p>
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
                    {d.contentType} · {fmtBytes(d.sizeBytes)} ·{' '}
                    {fmtDate(d.createdAt)}
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
