'use client';

import {
  actOnApproval,
  listApprovalInstances,
  type ApprovalInstance,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  btnPrimary,
  btnSecondary,
  inputCls,
  Modal,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import { CheckCircle2, Clock, Inbox, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

/** Finance-owned approval resources that surface in this portal queue. */
const FINANCE_RESOURCES = new Set([
  'PaymentVoucher',
  'PettyCashVoucher',
  'PayrollCycle',
]);

const TYPE_META: Record<
  string,
  { label: string; href?: string; hint: string }
> = {
  PaymentVoucher: {
    label: 'Payment voucher',
    href: '/finance/vouchers',
    hint: 'Payee, amount, then mark paid with a bank / mobile-money reference.',
  },
  PettyCashVoucher: {
    label: 'Petty cash',
    href: '/finance/petty-cash',
    hint: 'Cash is issued only after every approval step is complete.',
  },
  PayrollCycle: {
    label: 'Payroll cycle',
    href: '/payroll/cycles',
    hint: 'Payslips become payable once the cycle is fully approved.',
  },
};

const ROLE_LABEL: Record<string, string> = {
  GENERAL_MANAGER: 'General Manager',
  ACCOUNTS_OFFICER: 'Finance / Accounts Officer',
  PAYROLL_OFFICER: 'Payroll Officer',
  HR_OFFICER: 'HR Officer',
  CEO: 'CEO',
  CMD: 'CMD',
  SUPER_ADMIN: 'Super Admin',
};

function roleLabel(role?: string | null) {
  if (!role || role === '*') return 'Any approver';
  return ROLE_LABEL[role] ?? role;
}

function fmtAmount(n?: number | null) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `TZS ${n.toLocaleString()}`;
  }
}

type Tab = 'MINE' | 'PENDING' | 'DECIDED' | 'ALL';

const TABS: { id: Tab; label: string }[] = [
  { id: 'MINE', label: 'Awaiting me' },
  { id: 'PENDING', label: 'All pending' },
  { id: 'DECIDED', label: 'Decided' },
  { id: 'ALL', label: 'Everything' },
];

export default function FinanceApprovalsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const roles = session?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  const [rows, setRows] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('MINE');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalInstance | null>(
    null,
  );
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listApprovalInstances();
      setRows(all.filter((r) => FINANCE_RESOURCES.has(r.resourceType)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canActOn = useCallback(
    (r: ApprovalInstance) => {
      if (r.status !== 'PENDING') return false;
      if (session?.id && r.createdBy === session.id) return false;
      const required = r.requiredRole;
      if (!required || required === '*') return true;
      return isSuperAdmin || roles.includes(required);
    },
    [session, isSuperAdmin, roles],
  );

  const stats = useMemo(() => {
    let pending = 0;
    let mine = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.status === 'PENDING') {
        pending += 1;
        if (canActOn(r)) mine += 1;
      } else if (r.status === 'APPROVED') approved += 1;
      else if (r.status === 'REJECTED') rejected += 1;
    }
    return { pending, mine, approved, rejected, total: rows.length };
  }, [rows, canActOn]);

  const visible = useMemo(() => {
    if (tab === 'MINE') return rows.filter(canActOn);
    if (tab === 'PENDING') return rows.filter((r) => r.status === 'PENDING');
    if (tab === 'DECIDED') return rows.filter((r) => r.status !== 'PENDING');
    return rows;
  }, [rows, tab, canActOn]);

  async function act(
    row: ApprovalInstance,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) {
    setActingId(row.id);
    setError(null);
    setNotice(null);
    try {
      await actOnApproval(row.id, {
        decision,
        remarks:
          decision === 'REJECT'
            ? note?.trim() || 'Rejected from finance approvals'
            : undefined,
      });
      const label = TYPE_META[row.resourceType]?.label ?? row.resourceType;
      setNotice(
        decision === 'APPROVE'
          ? `${label} approved — the record is updated in this portal.`
          : `${label} rejected with remarks.`,
      );
      setRejectTarget(null);
      setRemarks('');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : decision === 'APPROVE'
            ? 'Approve failed'
            : 'Reject failed',
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">
            Finance approvals
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Payment vouchers, petty cash and payroll cycles waiting on a decision.
            Approving here updates the voucher/cycle immediately — the same rows
            also appear in the shared{' '}
            <Link
              href="/approvals"
              className="font-medium text-[#0078d4] hover:underline"
            >
              Approvals queue
            </Link>
            . Creator cannot approve their own request.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/finance/vouchers" className={btnSecondary}>
            Payment vouchers
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
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting me"
          value={stats.mine}
          hint="Your role is the current step"
          accent="amber"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="All pending"
          value={stats.pending}
          hint="Finance-owned approvals"
          accent="blue"
          icon={<Inbox className="h-5 w-5" />}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          hint="Cleared the whole matrix"
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          hint="Declined with remarks"
          accent="rose"
          icon={<XCircle className="h-5 w-5" />}
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

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count =
            t.id === 'MINE'
              ? stats.mine
              : t.id === 'PENDING'
                ? stats.pending
                : t.id === 'DECIDED'
                  ? stats.approved + stats.rejected
                  : stats.total;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                active
                  ? 'bg-[#0078d4] text-white shadow-sm'
                  : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
              }`}
            >
              {t.label}
              <span
                className={`tabular-nums ${active ? 'text-white/80' : 'text-[#a19f9d]'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created by</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={7}>
                  Loading finance approvals…
                </td>
              </tr>
            ) : null}
            {!loading && visible.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-xs text-[#8a8886]" colSpan={7}>
                  {rows.length === 0
                    ? 'No payment voucher, petty cash, or payroll approvals yet. Submit a voucher from /finance/vouchers to start the workflow.'
                    : tab === 'MINE'
                      ? 'Nothing is waiting on your role right now. Check “All pending” to see other steps.'
                      : 'No rows for this filter.'}
                </td>
              </tr>
            ) : null}
            {visible.map((row) => {
              const meta = TYPE_META[row.resourceType];
              const mine = session?.id && row.createdBy === session.id;
              const pending = row.status === 'PENDING';
              const allowed = canActOn(row);
              return (
                <tr key={row.id} className="border-t border-[#edebe9] align-top">
                  <td className="px-3 py-2">
                    <p className="text-[13px] font-medium text-[#1b1a19]">
                      {meta?.label ?? row.resourceType}
                    </p>
                    {meta?.href ? (
                      <Link
                        href={meta.href}
                        className="text-[11px] text-[#0078d4] hover:underline"
                      >
                        Open record →
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[13px] tabular-nums text-[#1b1a19]">
                    {fmtAmount(row.amount)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#605e5c]">
                    <span className="font-medium text-[#323130]">
                      {row.currentStepName ?? `Step ${row.currentStepOrder}`}
                    </span>
                    {pending ? (
                      <span className="block text-[#8a8886]">
                        Awaiting {roleLabel(row.requiredRole)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#605e5c]">
                    {mine ? (
                      <span className="font-medium text-[#1b1a19]">You</span>
                    ) : (
                      <span className="font-mono">{row.createdBy.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#605e5c]">
                    {new Date(row.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pending && allowed ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={actingId === row.id}
                          onClick={() => void act(row, 'APPROVE')}
                        >
                          {actingId === row.id ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={actingId === row.id}
                          onClick={() => {
                            setRemarks('');
                            setRejectTarget(row);
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : pending ? (
                      <span
                        className="text-[11px] text-[#8a8886]"
                        title={
                          mine
                            ? 'Creator cannot approve their own request'
                            : `Awaiting ${roleLabel(row.requiredRole)}`
                        }
                      >
                        {mine
                          ? 'You created this'
                          : `Awaiting ${roleLabel(row.requiredRole)}`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#a19f9d]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-[#605e5c]">
        Showing {visible.length} of {rows.length} finance approvals. Payroll
        cycles stay actionable in{' '}
        <Link href="/payroll/cycles" className="font-medium text-[#0078d4] hover:underline">
          the payroll console
        </Link>{' '}
        as well.
      </p>

      {rejectTarget ? (
        <Modal
          open
          title="Reject finance approval"
          description={`${
            TYPE_META[rejectTarget.resourceType]?.label ?? rejectTarget.resourceType
          } · ${rejectTarget.resourceId.slice(0, 8)}…`}
          onClose={() => {
            setRejectTarget(null);
            setRemarks('');
          }}
        >
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act(rejectTarget, 'REJECT', remarks);
            }}
          >
            <label className="block text-xs font-medium text-[#605e5c]">
              Reason
              <textarea
                className={`${inputCls} min-h-[72px]`}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Why is this being declined?"
              />
            </label>
            <p className="text-[11px] text-[#605e5c]">
              Left blank, this records “Rejected from finance approvals”. The
              creator keeps the record — nothing is deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setRejectTarget(null);
                  setRemarks('');
                }}
                disabled={actingId === rejectTarget.id}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={actingId === rejectTarget.id}
              >
                {actingId === rejectTarget.id ? 'Rejecting…' : 'Confirm reject'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
