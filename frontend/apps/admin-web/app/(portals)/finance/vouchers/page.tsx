'use client';

import {
  approvePaymentVoucher,
  createPaymentVoucher,
  listPaymentVouchers,
  payPaymentVoucher,
  type PaymentVoucher,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { Modal, StatCard, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { CheckCircle2, Plus, RefreshCw, Wallet } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const fmtTZS = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const VOUCHER_APPROVE_ROLES = new Set([
  'GENERAL_MANAGER',
  'SUPER_ADMIN',
  'CEO',
  'CMD',
]);

export default function FinanceVouchersPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canApproveStep = Boolean(
    session?.roles?.some((r) => VOUCHER_APPROVE_ROLES.has(r)),
  );
  const [rows, setRows] = useState<PaymentVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [payTarget, setPayTarget] = useState<PaymentVoucher | null>(null);
  const [payRef, setPayRef] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPaymentVouchers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) =>
      r.status.toUpperCase().includes('PENDING'),
    ).length;
    const approved = rows.filter((r) => r.status.toUpperCase() === 'APPROVED').length;
    const paid = rows.filter((r) => r.status.toUpperCase() === 'PAID');
    return {
      pending,
      approved,
      paidCount: paid.length,
      paidAmount: paid.reduce((s, r) => s + r.amount, 0),
    };
  }, [rows]);

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!payeeName.trim() || !purpose.trim() || !Number.isFinite(n) || n < 1) {
      setError('Payee, purpose, and amount (≥ 1) are required');
      return;
    }
    setBusyId('create');
    setError(null);
    try {
      await createPaymentVoucher({
        payeeName: payeeName.trim(),
        amount: n,
        purpose: purpose.trim(),
      });
      setCreateOpen(false);
      setPayeeName('');
      setAmount('');
      setPurpose('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (row: PaymentVoucher) => {
    setBusyId(row.id);
    setError(null);
    try {
      await approvePaymentVoucher(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!payTarget || !payRef.trim()) return;
    setBusyId(payTarget.id);
    setError(null);
    try {
      await payPaymentVoucher(payTarget.id, payRef.trim());
      setPayTarget(null);
      setPayRef('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pay failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Payment vouchers</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Accountant creates → GM approves (payment-voucher-approval) → another
            officer marks paid with a bank or mobile-money reference. Creator cannot
            approve or pay their own voucher.
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
            onClick={() => setCreateOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-4 w-4" />
            New voucher
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Pending approval"
          value={stats.pending}
          hint="Shared payment-voucher-approval"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          hint="Ready to pay"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="Paid"
          value={fmtTZS(stats.paidAmount)}
          hint={`${stats.paidCount} vouchers`}
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
            <tr>
              <th className="px-3 py-2">Voucher</th>
              <th className="px-3 py-2">Payee</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Purpose</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={6}>
                  No payment vouchers yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const mine = session?.id && row.createdBy === session.id;
              const pending = row.status.toUpperCase().includes('PENDING');
              const approved = row.status.toUpperCase() === 'APPROVED';
              return (
                <tr key={row.id} className="border-t border-[#edebe9]">
                  <td className="px-3 py-2 font-medium">{row.voucherNumber}</td>
                  <td className="px-3 py-2">{row.payeeName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtTZS(row.amount, row.currency)}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.status}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-xs text-[#605e5c]">
                    {row.purpose}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pending && canApproveStep ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busyId === row.id || Boolean(mine)}
                        title={mine ? 'Creator cannot approve' : undefined}
                        onClick={() => void handleApprove(row)}
                      >
                        Approve
                      </button>
                    ) : null}
                    {pending && !canApproveStep ? (
                      <span className="text-[11px] text-[#8a8886]">Awaiting GM</span>
                    ) : null}
                    {approved ? (
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busyId === row.id || Boolean(mine)}
                        title={mine ? 'Creator cannot pay' : undefined}
                        onClick={() => {
                          setPayTarget(row);
                          setPayRef('');
                        }}
                      >
                        Pay
                      </button>
                    ) : null}
                    {row.paymentReference ? (
                      <span className="text-[11px] text-[#8a8886]">
                        {row.paymentReference}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New payment voucher"
      >
        <form className="space-y-3" onSubmit={(e) => void submitCreate(e)}>
          <label className="block text-xs font-medium text-[#605e5c]">
            Payee
            <input
              className={inputCls}
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Amount (TZS)
            <input
              className={inputCls}
              type="number"
              min={1}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Purpose
            <textarea
              className={inputCls}
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={busyId === 'create'}>
              Submit for approval
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={payTarget ? `Pay ${payTarget.voucherNumber}` : 'Pay'}
      >
        <form className="space-y-3" onSubmit={(e) => void handlePay(e)}>
          <p className="text-xs text-[#605e5c]">
            Record the bank / mobile-money reference. This is not a bank
            reconciliation match.
          </p>
          <label className="block text-xs font-medium text-[#605e5c]">
            Payment reference
            <input
              className={inputCls}
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setPayTarget(null)}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={!payTarget}>
              Mark paid
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
