'use client';

import {
  approveLoan,
  createLoan,
  getLoanStatement,
  issueLoan,
  isItemLoanType,
  listLoanEmployeeOptions,
  listLoanInstallments,
  listLoans,
  LOAN_TYPE_OPTIONS,
  rejectLoan,
  type CreateLoanBody,
  type EmployeeLoan,
  type LoanEmployeeOption,
  type LoanInstallment,
  type LoanStatement,
  type LoanType,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  Plus,
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
import { LoanRoster, LoansEmpty } from './_components/LoanRoster';

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

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

/** Nest often returns JSON in Error.message — surface message / role hints clearly. */
function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* plain text */
  }
  return raw;
}

type StatusFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'rejected';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

export default function LoansAdminPage() {
  const [employees, setEmployees] = useState<LoanEmployeeOption[]>([]);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<EmployeeLoan | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<EmployeeLoan | null>(
    null,
  );
  const [issueTarget, setIssueTarget] = useState<EmployeeLoan | null>(null);
  const [statementTarget, setStatementTarget] = useState<EmployeeLoan | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, rows] = await Promise.all([
        listLoanEmployeeOptions(),
        listLoans(),
      ]);
      setEmployees(emps);
      setLoans(rows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const employeeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.fullName);
    return map;
  }, [employees]);

  const counts = useMemo(() => {
    const c = {
      all: loans.length,
      pending: 0,
      approved: 0,
      active: 0,
      completed: 0,
      rejected: 0,
      outstanding: 0,
    };
    for (const r of loans) {
      const s = norm(r.status);
      if (s === 'pending_approval' || s === 'draft') c.pending += 1;
      else if (s === 'approved') {
        c.approved += 1;
        c.outstanding += r.principalAmount;
      } else if (s === 'active') {
        c.active += 1;
        c.outstanding += r.principalAmount;
      } else if (s === 'completed') c.completed += 1;
      else if (s === 'rejected' || s === 'cancelled') c.rejected += 1;
    }
    return c;
  }, [loans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((r) => {
      const s = norm(r.status);
      if (statusFilter === 'pending') {
        if (s !== 'pending_approval' && s !== 'draft') return false;
      } else if (statusFilter === 'rejected') {
        if (s !== 'rejected' && s !== 'cancelled') return false;
      } else if (statusFilter !== 'all' && s !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const name = (employeeName.get(r.employeeId) ?? '').toLowerCase();
      return (
        name.includes(q) ||
        r.loanNumber.toLowerCase().includes(q) ||
        (r.purpose ?? '').toLowerCase().includes(q) ||
        (r.itemName ?? '').toLowerCase().includes(q) ||
        (r.loanType ?? '').toLowerCase().includes(q)
      );
    });
  }, [loans, query, statusFilter, employeeName]);

  const onApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveLoan(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Employee Loans"
        description="Org-wide loan register, approval, and installment schedules. Employees self-apply via ESS."
        actions={
          <>
            <Link href="/ess/loans" className={btnSecondary}>
              ESS self-apply
            </Link>
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
              New loan
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total loans"
          value={counts.all}
          hint={
            counts.completed > 0
              ? `${counts.completed} completed`
              : 'Org-wide register'
          }
          accent="blue"
          icon={<Coins className="h-5 w-5" />}
        />
        <StatCard
          label="Pending approval"
          value={counts.pending}
          hint="Creator ≠ approver"
          accent="amber"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={counts.active}
          hint={
            counts.approved > 0
              ? `${counts.approved} approved (not yet active)`
              : 'On repayment'
          }
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Principal (open)"
          value={formatMoney(counts.outstanding)}
          hint="Approved + active"
          accent="violet"
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
            <CalendarClock className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Loan register
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Approve pending · view installment schedules · ESS applications land
            here
          </p>
        </div>
      </div>

      <LoanRoster
        rows={filtered}
        loading={loading}
        employeeName={employeeName}
        busyId={busyId}
        onApprove={(id) => void onApprove(id)}
        onReject={setRejectTarget}
        onSchedule={setScheduleTarget}
        onIssue={setIssueTarget}
        onStatement={setStatementTarget}
        canAct={(r) => {
          if (norm(r.status) !== 'pending_approval') return false;
          const isOwn =
            !!sessionUser?.id &&
            !!r.createdBy &&
            r.createdBy === sessionUser.id;
          const isSuperAdmin =
            sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;
          if (isOwn && !isSuperAdmin) return 'own';
          return true;
        }}
        canIssue={(r) => {
          if (norm(r.status) !== 'approved') return false;
          const isOwn =
            !!sessionUser?.id &&
            !!r.createdBy &&
            r.createdBy === sessionUser.id;
          const isSuperAdmin =
            sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;
          if (isOwn && !isSuperAdmin) return 'own';
          return true;
        }}
        toolbar={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee, loan #, purpose…"
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
          <LoansEmpty
            title={loans.length === 0 ? 'No loans yet' : 'No matches'}
            description={
              loans.length === 0
                ? 'Create a loan for an employee, or wait for ESS applications. Approval requires an authorized officer (creator ≠ approver).'
                : 'Try another search or status filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {loans.length} loans
        </p>
      ) : null}

      {createOpen ? (
        <CreateLoanModal
          employees={employees}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectLoanModal
          loan={rejectTarget}
          employeeName={
            employeeName.get(rejectTarget.employeeId) ??
            rejectTarget.employeeId
          }
          onClose={() => setRejectTarget(null)}
          onRejected={async () => {
            setRejectTarget(null);
            await refresh();
          }}
        />
      ) : null}

      {scheduleTarget ? (
        <ScheduleModal
          loan={scheduleTarget}
          employeeName={
            employeeName.get(scheduleTarget.employeeId) ??
            scheduleTarget.employeeId
          }
          onClose={() => setScheduleTarget(null)}
        />
      ) : null}

      {issueTarget ? (
        <IssueLoanModal
          loan={issueTarget}
          employeeName={
            employeeName.get(issueTarget.employeeId) ?? issueTarget.employeeId
          }
          onClose={() => setIssueTarget(null)}
          onIssued={async () => {
            setIssueTarget(null);
            await refresh();
          }}
        />
      ) : null}

      {statementTarget ? (
        <StatementModal
          loan={statementTarget}
          employeeName={
            employeeName.get(statementTarget.employeeId) ??
            statementTarget.employeeId
          }
          onClose={() => setStatementTarget(null)}
        />
      ) : null}
    </>
  );
}

function CreateLoanModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: LoanEmployeeOption[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [loanType, setLoanType] = useState<LoanType>('CASH');
  const [principalAmount, setPrincipalAmount] = useState('500000');
  const [termMonths, setTermMonths] = useState('6');
  const [interestRate, setInterestRate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [itemName, setItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemRequired = isItemLoanType(loanType);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateLoanBody = {
        employeeId,
        loanType,
        principalAmount: Number(principalAmount),
        termMonths: Number(termMonths),
      };
      if (purpose.trim()) body.purpose = purpose.trim();
      if (itemRequired && itemName.trim()) body.itemName = itemName.trim();
      if (interestRate.trim() !== '') {
        body.interestRate = Number(interestRate);
      }
      await createLoan(body);
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New loan"
      description="Starts the loan-approval workflow (creator ≠ approver)."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130] sm:col-span-2">
            Loan type
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as LoanType)}
              className={inputCls}
              required
            >
              {LOAN_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {itemRequired ? (
            <label className="block text-sm font-medium text-[#323130] sm:col-span-2">
              Item name
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Security boots size 42"
                required
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-[#323130] sm:col-span-2">
            Employee
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={inputCls}
              required
            >
              {employees.length === 0 ? (
                <option value="">No employees</option>
              ) : (
                employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.employeeNumber})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Principal (TZS)
            <input
              type="number"
              min={1}
              step={1}
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Term (months)
            <input
              type="number"
              min={1}
              step={1}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Interest rate % (optional)
            <input
              type="number"
              min={0}
              step={0.01}
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Notes (optional)
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Optional notes for approver"
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting || employees.length === 0}
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectLoanModal({
  loan,
  employeeName,
  onClose,
  onRejected,
}: {
  loan: EmployeeLoan;
  employeeName: string;
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
      await rejectLoan(loan.id, reason.trim());
      await onRejected();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Reject loan"
      description={`${employeeName} · ${loan.loanNumber} · ${formatMoney(loan.principalAmount)}`}
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="At least 3 characters"
            required
            minLength={3}
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
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

function ScheduleModal({
  loan,
  employeeName,
  onClose,
}: {
  loan: EmployeeLoan;
  employeeName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LoanInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await listLoanInstallments(loan.id);
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loan.id]);

  return (
    <Modal
      title="Installment schedule"
      description={`${employeeName} · ${loan.loanNumber} · ${loan.termMonths} months`}
      onClose={onClose}
      size="lg"
    >
      {error ? (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="py-6 text-center text-sm text-[#605e5c]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#605e5c]">
          No installments yet. Issue the approved loan to generate the schedule.
        </p>
      ) : (
        <div className="max-h-[360px] overflow-auto rounded border border-[#e1dfdd]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Amount due</th>
                <th className="px-3 py-2 font-semibold">Paid</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  className="border-t border-[#edebe9] text-[#323130]"
                >
                  <td className="px-3 py-2 font-mono">
                    {i.installmentNumber}
                  </td>
                  <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(i.amountDue)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(i.amountPaid)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function IssueLoanModal({
  loan,
  employeeName,
  onClose,
  onIssued,
}: {
  loan: EmployeeLoan;
  employeeName: string;
  onClose: () => void;
  onIssued: () => Promise<void>;
}) {
  const itemLoan = isItemLoanType(String(loan.loanType));
  const [itemName, setItemName] = useState(loan.itemName ?? '');
  const [supplierName, setSupplierName] = useState(loan.supplierName ?? '');
  const [itemCost, setItemCost] = useState(
    loan.itemCost != null ? String(loan.itemCost) : String(loan.principalAmount),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issueLoan(loan.id, {
        itemName: itemLoan ? itemName.trim() : undefined,
        supplierName: itemLoan ? supplierName.trim() || undefined : undefined,
        itemCost: itemLoan && itemCost.trim() ? Number(itemCost) : undefined,
      });
      await onIssued();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Issue loan"
      description={`${employeeName} · ${loan.loanNumber} · ${formatMoney(loan.principalAmount)}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-[#605e5c]">
          Issue records cash or item disbursement and generates the payroll
          deduction schedule. Creator cannot issue their own application.
        </p>
        {itemLoan ? (
          <>
            <label className="block text-sm font-medium text-[#323130]">
              Item name
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className={inputCls}
                required
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Supplier
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={inputCls}
                placeholder="Optional supplier name"
              />
            </label>
            <label className="block text-sm font-medium text-[#323130]">
              Item cost (TZS)
              <input
                type="number"
                min={0}
                value={itemCost}
                onChange={(e) => setItemCost(e.target.value)}
                className={inputCls}
              />
            </label>
          </>
        ) : (
          <p className="rounded-md bg-[#f3f9fd] px-3 py-2 text-sm text-[#323130]">
            Cash/support loan — disbursement date will be recorded on issue.
          </p>
        )}
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Issuing…' : 'Issue loan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StatementModal({
  loan,
  employeeName,
  onClose,
}: {
  loan: EmployeeLoan;
  employeeName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<LoanStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const stmt = await getLoanStatement(loan.id);
        if (!cancelled) setData(stmt);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loan.id]);

  return (
    <Modal
      title="Loan statement"
      description={`${employeeName} · ${loan.loanNumber}`}
      onClose={onClose}
      size="lg"
    >
      {error ? (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="py-6 text-center text-sm text-[#605e5c]">Loading…</p>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Total due</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.totalDue)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Paid</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.totalPaid)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Outstanding</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.outstandingBalance)}
              </p>
            </div>
          </div>
          {data.isSettled ? (
            <p className="text-xs font-medium text-emerald-700">
              Settled / cleared
              {data.loan.settledAt
                ? ` · ${formatDate(String(data.loan.settledAt))}`
                : ''}
            </p>
          ) : null}
          {data.installments.length > 0 ? (
            <div className="max-h-[280px] overflow-auto rounded border border-[#e1dfdd]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                    <th className="px-3 py-2 font-semibold">Due amt</th>
                    <th className="px-3 py-2 font-semibold">Paid</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.installments.map((i) => (
                    <tr
                      key={i.installmentNumber}
                      className="border-t border-[#edebe9]"
                    >
                      <td className="px-3 py-2 font-mono">
                        {i.installmentNumber}
                      </td>
                      <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(i.amountDue)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(i.amountPaid)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#605e5c]">
              No repayment schedule yet — issue the loan first.
            </p>
          )}
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Close
        </button>
      </div>
    </Modal>
  );
}
