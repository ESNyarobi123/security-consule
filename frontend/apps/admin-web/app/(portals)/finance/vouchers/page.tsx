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
import { CheckCircle2, Info, Plus, RefreshCw, Wallet } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const fmtTZS = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

const ROLE_LABEL: Record<string, string> = {
  GENERAL_MANAGER: 'General Manager',
  ACCOUNTS_OFFICER: 'Finance / Accounts Officer',
  CEO: 'CEO',
  CMD: 'CMD',
  SUPER_ADMIN: 'Super Admin',
};

function roleLabel(role?: string | null) {
  if (!role || role === '*') return 'Approver';
  return ROLE_LABEL[role] ?? role;
}

export default function FinanceVouchersPage() {
  const session = useMemo(() => getSessionUser(), []);
  const roles = session?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const [rows, setRows] = useState<PaymentVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const isPending = (row: PaymentVoucher) => {
    const s = row.status.toUpperCase();
    return s === 'PENDING_APPROVAL' || s === 'PENDING';
  };

  function canAct(row: PaymentVoucher) {
    if (!isPending(row)) return false;
    if (session?.id && row.createdBy === session.id) return false;
    const required = row.approvalRequiredRole;
    if (!required || required === '*') return true;
    return isSuperAdmin || roles.includes(required);
  }

  const stats = useMemo(() => {
    const pending = rows.filter((r) => isPending(r));
    const approved = rows.filter(
      (r) => r.status.toUpperCase() === 'APPROVED',
    ).length;
    const paid = rows.filter((r) => r.status.toUpperCase() === 'PAID');
    return {
      pending: pending.length,
      pendingAmount: pending.reduce((s, r) => s + r.amount, 0),
      awaitingMe: pending.filter(
        (r) =>
          (!r.approvalRequiredRole || r.approvalRequiredRole === '*'
            ? true
            : isSuperAdmin || roles.includes(r.approvalRequiredRole)) &&
          !(session?.id && r.createdBy === session.id),
      ).length,
      approved,
      paidCount: paid.length,
      paidAmount: paid.reduce((s, r) => s + r.amount, 0),
    };
  }, [rows, roles, isSuperAdmin, session]);

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
      const created = await createPaymentVoucher({
        payeeName: payeeName.trim(),
        amount: n,
        purpose: purpose.trim(),
      });
      setCreateOpen(false);
      setPayeeName('');
      setAmount('');
      setPurpose('');
      setNotice(
        `${created.voucherNumber} submitted — it is now waiting for ${
          roleLabel(created.approvalRequiredRole) || 'GM'
        } in the Approvals queue.`,
      );
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
    setNotice(null);
    try {
      const updated = await approvePaymentVoucher(row.id);
      if (updated.status.toUpperCase() === 'APPROVED') {
        setNotice(
          `${updated.voucherNumber} fully approved — it can now be marked paid.`,
        );
      } else {
        setNotice(
          `${updated.voucherNumber} moved to step #${
            updated.approvalStepOrder ?? '?'
          } — waiting for ${roleLabel(updated.approvalRequiredRole)}.`,
        );
      }
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
            Accountant creates → the shared <code>payment-voucher-approval</code>{' '}
            workflow routes it to the GM → another officer marks paid with a bank or
            mobile-money reference. Creator cannot approve or pay their own voucher.
            Approvals also appear in the{' '}
            <Link href="/approvals" className="font-medium text-[#0078d4] hover:underline">
              Approvals queue
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/approvals" className={btnSecondary}>
            Approvals queue
          </Link>
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
            onClick={() => {
              setNotice(null);
              setCreateOpen(true);
            }}
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
          hint={
            stats.pending > 0
              ? `${fmtTZS(stats.pendingAmount)} · ${stats.awaitingMe} awaiting you`
              : 'Shared payment-voucher-approval'
          }
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

      {notice ? (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {stats.pending > 0 ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-[#c7e0f4] bg-[#f3f9fd] px-3 py-2 text-xs text-[#0067b8]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {stats.pending} voucher{stats.pending === 1 ? '' : 's'} waiting for
            approval. The GM can decide here or in{' '}
            <Link href="/approvals" className="font-semibold underline">
              /approvals
            </Link>{' '}
            — both paths update the voucher status.
          </span>
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
              <th className="px-3 py-2">Approval</th>
              <th className="px-3 py-2">Purpose</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={7}>
                  No payment vouchers yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const mine = session?.id && row.createdBy === session.id;
              const pending = isPending(row);
              const approved = row.status.toUpperCase() === 'APPROVED';
              const act = canAct(row);
              return (
                <tr key={row.id} className="border-t border-[#edebe9]">
                  <td className="px-3 py-2 font-medium">{row.voucherNumber}</td>
                  <td className="px-3 py-2">{row.payeeName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtTZS(row.amount, row.currency)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.status.replaceAll('_', ' ')}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#605e5c]">
                    {pending ? (
                      <>
                        <span className="font-medium text-[#323130]">
                          {row.approvalCurrentStepName ??
                            `Step ${row.approvalStepOrder ?? 1}`}
                        </span>
                        <span className="block text-[#8a8886]">
                          Awaiting {roleLabel(row.approvalRequiredRole)}
                        </span>
                      </>
                    ) : row.approvalStatus ? (
                      <span className="text-[#8a8886]">
                        {row.approvalStatus}
                        {row.approvedBy ? ' · approved' : ''}
                      </span>
                    ) : (
                      <span className="text-[#a19f9d]">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-[#605e5c]">
                    {row.purpose}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pending && act ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busyId === row.id}
                        onClick={() => void handleApprove(row)}
                      >
                        Approve
                      </button>
                    ) : null}
                    {pending && !act ? (
                      <span
                        className="text-[11px] text-[#8a8886]"
                        title={
                          mine
                            ? 'Creator cannot approve'
                            : `Awaiting ${roleLabel(row.approvalRequiredRole)}`
                        }
                      >
                        {mine
                          ? 'You created this'
                          : `Awaiting ${roleLabel(row.approvalRequiredRole)}`}
                      </span>
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
                      <span className="ml-2 text-[11px] text-[#8a8886]">
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
        description="Submitting starts the payment-voucher-approval workflow (GM review)."
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
            <button
              type="submit"
              className={btnPrimary}
              disabled={busyId === 'create'}
            >
              {busyId === 'create' ? 'Submitting…' : 'Submit for GM approval'}
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
