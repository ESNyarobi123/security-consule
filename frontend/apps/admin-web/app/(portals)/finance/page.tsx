'use client';

import {
  listInvoices,
  recordInvoicePayment,
  sendInvoice,
  type Invoice,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Clock, FileText, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

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

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const isOpen = (status: string) => status !== 'PAID' && status !== 'VOIDED';

export default function FinancePage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listInvoices());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const totalInvoiced = rows.reduce((s, r) => s + r.totalAmount, 0);
    const collected = rows.reduce((s, r) => s + r.amountPaid, 0);
    const outstanding = Math.max(totalInvoiced - collected, 0);
    const open = rows.filter((r) => isOpen(r.status)).length;
    return { totalInvoiced, collected, outstanding, open };
  }, [rows]);

  const handleSend = useCallback(
    async (inv: Invoice) => {
      setBusyId(inv.id);
      try {
        await sendInvoice(inv.id);
        await load();
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

  const submitPayment = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!payTarget) return;
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      setSaving(true);
      try {
        await recordInvoicePayment(payTarget.id, {
          amount,
          paymentReference: payRef.trim() || `PAY-${Date.now()}`,
        });
        setPayTarget(null);
        await load();
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
        description="Customer invoices — send and record payments"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
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

      <div className="mt-8">
        <SectionTitle>Invoices</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
          emptyMessage="No invoices yet."
          columns={[
            {
              key: 'invoiceNumber',
              label: 'Invoice #',
              render: (r) => (
                <span className="font-medium text-[#1b1a19]">
                  {r.invoiceNumber}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'totalAmount',
              label: 'Total',
              render: (r) => fmtMoney(r.totalAmount, r.currency),
            },
            {
              key: 'amountPaid',
              label: 'Paid',
              render: (r) => (
                <span className="text-[#107c10]">
                  {fmtMoney(r.amountPaid, r.currency)}
                </span>
              ),
            },
            {
              // key must be a unique keyof Invoice; render computes the balance
              key: 'currency',
              label: 'Balance',
              render: (r) => {
                const bal = Math.max(r.totalAmount - r.amountPaid, 0);
                return (
                  <span className={bal > 0 ? 'text-[#323130]' : 'text-[#605e5c]'}>
                    {fmtMoney(bal, r.currency)}
                  </span>
                );
              },
            },
            {
              key: 'dueDate',
              label: 'Due',
              render: (r) => (
                <span className="text-[#605e5c]">{fmtDate(r.dueDate)}</span>
              ),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => {
                const canSend = r.status === 'DRAFT';
                const canPay =
                  r.status === 'SENT' || r.status === 'PARTIALLY_PAID';
                if (!canSend && !canPay) {
                  return <span className="text-xs text-[#605e5c]">—</span>;
                }
                return (
                  <div className="flex gap-3">
                    {canSend ? (
                      <button
                        type="button"
                        onClick={() => void handleSend(r)}
                        disabled={busyId === r.id}
                        className="text-xs font-medium text-[#0067b8] hover:underline disabled:opacity-50"
                      >
                        {busyId === r.id ? 'Sending…' : 'Send'}
                      </button>
                    ) : null}
                    {canPay ? (
                      <button
                        type="button"
                        onClick={() => openPayment(r)}
                        className="text-xs font-medium text-[#0067b8] hover:underline"
                      >
                        Record payment
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {payTarget ? (
        <Modal
          title="Record payment"
          description={`Invoice ${payTarget.invoiceNumber}`}
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
