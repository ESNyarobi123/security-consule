'use client';

import {
  createInvoice,
  listContracts,
  listCustomers,
  listInvoices,
  recordInvoicePayment,
  scanOverdueInvoices,
  sendInvoice,
  voidInvoice,
  type Contract,
  type Customer,
  type Invoice,
} from '@pssms/api-client';
import {
  Modal,
  PageHeader,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  AlarmClock,
  Clock,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { InvoiceRoster, InvoicesEmpty } from './_components/InvoiceRoster';

const BILLABLE = new Set(['ACTIVE', 'APPROVED', 'EXPIRING']);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmtTZS = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const fmtMoney = (n: number, currency: string) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

const isOpen = (status: string) => {
  const s = norm(status);
  return s !== 'paid' && s !== 'voided' && s !== 'cancelled';
};

type StatusFilter =
  | 'all'
  | 'draft'
  | 'sent'
  | 'partial'
  | 'overdue'
  | 'paid'
  | 'voided';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Sent' },
  { id: 'partial', label: 'Partial' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'voided', label: 'Voided' },
];

function matchesFilter(status: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const s = norm(status);
  if (filter === 'partial') return s === 'partially_paid';
  if (filter === 'voided') return s === 'voided' || s === 'cancelled';
  return s === filter;
}

export default function FinancePage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formContractId, setFormContractId] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formIssue, setFormIssue] = useState(todayIso);
  const [formDue, setFormDue] = useState(() => plusDaysIso(30));
  const [formLine, setFormLine] = useState('');
  const [formQty, setFormQty] = useState('1');
  const [formUnit, setFormUnit] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoices, custs, ctrs] = await Promise.all([
        listInvoices(),
        listCustomers().catch(() => [] as Customer[]),
        listContracts().catch(() => [] as Contract[]),
      ]);
      setRows(invoices);
      setCustomers(custs);
      setContracts(ctrs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const billableContracts = useMemo(() => {
    if (!formCustomerId) return [];
    return contracts.filter(
      (c) =>
        c.customerId === formCustomerId &&
        BILLABLE.has(c.status.trim().toUpperCase()),
    );
  }, [contracts, formCustomerId]);

  const customerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(c.id, c.name);
    return map;
  }, [customers]);

  const customerCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(c.id, c.code);
    return map;
  }, [customers]);

  const stats = useMemo(() => {
    const totalInvoiced = rows.reduce((s, r) => s + r.totalAmount, 0);
    const collected = rows.reduce((s, r) => s + r.amountPaid, 0);
    const outstanding = Math.max(totalInvoiced - collected, 0);
    const open = rows.filter((r) => isOpen(r.status)).length;
    return { totalInvoiced, collected, outstanding, open };
  }, [rows]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      draft: 0,
      sent: 0,
      partial: 0,
      overdue: 0,
      paid: 0,
      voided: 0,
    };
    for (const r of rows) {
      const s = norm(r.status);
      if (s === 'draft') c.draft += 1;
      else if (s === 'sent') c.sent += 1;
      else if (s === 'partially_paid') c.partial += 1;
      else if (s === 'overdue') c.overdue += 1;
      else if (s === 'paid') c.paid += 1;
      else if (s === 'voided' || s === 'cancelled') c.voided += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r.status, statusFilter)) return false;
      if (!q) return true;
      const name = (customerName.get(r.customerId) ?? '').toLowerCase();
      const ctr = (r.contractNumber ?? '').toLowerCase();
      return (
        name.includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        ctr.includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, customerName]);

  const openCreate = useCallback(() => {
    const first = customers[0]?.id ?? '';
    setFormCustomerId(first);
    setFormContractId('');
    setFormNumber(`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
    setFormIssue(todayIso());
    setFormDue(plusDaysIso(30));
    setFormLine('');
    setFormQty('1');
    setFormUnit('');
    setCreateOpen(true);
  }, [customers]);

  useEffect(() => {
    if (!createOpen || !formCustomerId) return;
    setFormContractId((prev) => {
      if (
        prev &&
        contracts.some(
          (c) =>
            c.id === prev &&
            c.customerId === formCustomerId &&
            BILLABLE.has(c.status.trim().toUpperCase()),
        )
      ) {
        return prev;
      }
      const match = contracts.find(
        (c) =>
          c.customerId === formCustomerId &&
          BILLABLE.has(c.status.trim().toUpperCase()),
      );
      if (match) {
        setFormLine((line) => line || match.title);
        const fee = Number(match.monthlyFee);
        if (Number.isFinite(fee) && fee > 0) {
          setFormUnit((u) => u || String(fee));
        }
      }
      return match?.id ?? '';
    });
  }, [createOpen, formCustomerId, contracts]);

  const submitCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!formCustomerId || !formNumber.trim() || !formLine.trim()) return;
      const qty = Number(formQty);
      const unit = Number(formUnit);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
        setError('Enter a valid quantity and unit price');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await createInvoice({
          customerId: formCustomerId,
          ...(formContractId ? { contractId: formContractId } : {}),
          invoiceNumber: formNumber.trim(),
          issueDate: formIssue,
          dueDate: formDue,
          currency: 'TZS',
          lines: [
            {
              description: formLine.trim(),
              quantity: qty,
              unitPrice: unit,
            },
          ],
        });
        setCreateOpen(false);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create invoice failed');
      } finally {
        setSaving(false);
      }
    },
    [
      formContractId,
      formCustomerId,
      formDue,
      formIssue,
      formLine,
      formNumber,
      formQty,
      formUnit,
      load,
    ],
  );

  const handleSend = useCallback(
    async (inv: Invoice) => {
      setBusyId(inv.id);
      setError(null);
      try {
        await sendInvoice(inv.id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const openPayment = useCallback((inv: Invoice) => {
    setPayTarget(inv);
    setPayAmount(String(Math.max(inv.totalAmount - inv.amountPaid, 0)));
    setPayRef(`PAY-${Date.now()}`);
  }, []);

  const openVoid = useCallback((inv: Invoice) => {
    setVoidTarget(inv);
    setVoidReason('');
  }, []);

  const submitVoid = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!voidTarget) return;
      setSaving(true);
      setError(null);
      try {
        await voidInvoice(voidTarget.id, {
          reason: voidReason.trim() || undefined,
        });
        setVoidTarget(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Void failed');
      } finally {
        setSaving(false);
      }
    },
    [load, voidReason, voidTarget],
  );

  const handleScanOverdue = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await scanOverdueInvoices();
      await load();
      if (res.markedOverdue === 0) {
        setError('Scan complete — no past-due SENT/PARTIALLY_PAID invoices.');
      } else {
        setError(
          `Marked ${res.markedOverdue} overdue: ${res.invoiceNumbers.join(', ')}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Overdue scan failed');
    } finally {
      setScanning(false);
    }
  }, [load]);

  const submitPayment = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!payTarget) return;
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      setSaving(true);
      setError(null);
      try {
        await recordInvoicePayment(payTarget.id, {
          amount,
          paymentReference: payRef.trim() || `PAY-${Date.now()}`,
        });
        setPayTarget(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment failed');
      } finally {
        setSaving(false);
      }
    },
    [load, payAmount, payRef, payTarget],
  );

  return (
    <>
      <PageHeader
        title="Finance"
        description="Customer invoices — create, send, void, record payments, and scan past-due to OVERDUE. Imprest is under Petty cash."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/petty-cash" className={btnSecondary}>
              Petty cash
            </Link>
            <button
              type="button"
              onClick={() => void handleScanOverdue()}
              className={btnSecondary}
              disabled={scanning || loading}
            >
              <AlarmClock
                className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`}
              />
              {scanning ? 'Scanning…' : 'Scan overdue'}
            </button>
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
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              New invoice
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total invoiced"
          value={fmtTZS(stats.totalInvoiced)}
          hint={`${rows.length} invoice${rows.length === 1 ? '' : 's'}`}
          icon={<Receipt className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Collected"
          value={fmtTZS(stats.collected)}
          hint="Payments recorded"
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Outstanding"
          value={fmtTZS(stats.outstanding)}
          hint="Awaiting collection"
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Open invoices"
          value={stats.open}
          hint="Not fully settled"
          icon={<FileText className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <section className="mt-8">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#0078d4]" />
              <h2 className="text-[15px] font-semibold text-[#1b1a19]">
                Invoices
              </h2>
              <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
                {filtered.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Send drafts · record customer payments · imprest stays under Petty
              cash
            </p>
          </div>
        </div>

        <InvoiceRoster
          rows={filtered}
          loading={loading}
          customerName={customerName}
          customerCode={customerCode}
          busyId={busyId}
          onSend={(inv) => void handleSend(inv)}
          onPay={openPayment}
          onVoid={openVoid}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customer, invoice #, contract…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => {
                  const active = statusFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
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
            <InvoicesEmpty
              title={rows.length === 0 ? 'No invoices yet' : 'No matches'}
              description={
                rows.length === 0
                  ? 'Create an invoice (optionally linked to an ACTIVE/APPROVED/EXPIRING contract), send the draft, then record payments.'
                  : 'Try another search or status filter.'
              }
            />
          }
        />
        {!loading && filtered.length > 0 ? (
          <p className="mt-2 text-[11px] text-[#605e5c]">
            Showing {filtered.length} of {rows.length} invoices
          </p>
        ) : null}
      </section>

      {createOpen ? (
        <Modal
          title="New invoice"
          description="Link to a billable contract when the charge belongs to a service agreement."
          onClose={() => setCreateOpen(false)}
        >
          <form onSubmit={(e) => void submitCreate(e)} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Customer
              </label>
              <select
                className={inputCls}
                value={formCustomerId}
                onChange={(e) => {
                  setFormCustomerId(e.target.value);
                  setFormContractId('');
                  setFormLine('');
                  setFormUnit('');
                }}
                required
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Contract (optional)
              </label>
              <select
                className={inputCls}
                value={formContractId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFormContractId(id);
                  const c = contracts.find((x) => x.id === id);
                  if (c) {
                    setFormLine(c.title);
                    const fee = Number(c.monthlyFee);
                    if (Number.isFinite(fee) && fee > 0) setFormUnit(String(fee));
                  }
                }}
                disabled={!formCustomerId}
              >
                <option value="">No contract link</option>
                {billableContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractNumber} · {c.serviceType} · {c.status}
                  </option>
                ))}
              </select>
              {formCustomerId && billableContracts.length === 0 ? (
                <p className="mt-1 text-[11px] text-amber-800">
                  No APPROVED / ACTIVE / EXPIRING contracts for this customer.
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Invoice number
              </label>
              <input
                className={inputCls}
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[#323130]">
                  Issue date
                </label>
                <input
                  className={inputCls}
                  type="date"
                  value={formIssue}
                  onChange={(e) => setFormIssue(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#323130]">
                  Due date
                </label>
                <input
                  className={inputCls}
                  type="date"
                  value={formDue}
                  onChange={(e) => setFormDue(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Line description
              </label>
              <input
                className={inputCls}
                value={formLine}
                onChange={(e) => setFormLine(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[#323130]">
                  Quantity
                </label>
                <input
                  className={inputCls}
                  type="number"
                  min="0.01"
                  step="any"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#323130]">
                  Unit price (TZS)
                </label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="1"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? 'Creating…' : 'Create draft'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {voidTarget ? (
        <Modal
          title="Void invoice"
          description={`Void ${voidTarget.invoiceNumber} — unpaid DRAFT/SENT/OVERDUE only.`}
          onClose={() => setVoidTarget(null)}
        >
          <form onSubmit={(e) => void submitVoid(e)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Reason (optional)
              </label>
              <input
                className={inputCls}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Duplicate / superseded…"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? 'Voiding…' : 'Confirm void'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {payTarget ? (
        <Modal
          title="Record payment"
          description={`Invoice ${payTarget.invoiceNumber}${
            customerName.get(payTarget.customerId)
              ? ` · ${customerName.get(payTarget.customerId)}`
              : ''
          }`}
          onClose={() => setPayTarget(null)}
        >
          <form onSubmit={submitPayment} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Amount ({payTarget.currency || 'TZS'})
              </label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-[11px] text-[#605e5c]">
                Outstanding:{' '}
                {fmtMoney(
                  Math.max(payTarget.totalAmount - payTarget.amountPaid, 0),
                  payTarget.currency,
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Payment reference
              </label>
              <input
                className={inputCls}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="PAY-..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
