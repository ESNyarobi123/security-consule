'use client';

import {
  approveLoan,
  createLoan,
  listLoanEmployeeOptions,
  listLoanInstallments,
  listLoans,
  rejectLoan,
  type CreateLoanBody,
  type EmployeeLoan,
  type LoanEmployeeOption,
  type LoanInstallment,
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
import { Coins, Plus, RefreshCw } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

function canShowSchedule(status: string) {
  const s = norm(status);
  return s === 'active' || s === 'completed' || s === 'approved';
}

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

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {loans.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
              <Coins className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium text-[#323130]">No loans yet</p>
            <p className="max-w-sm text-xs text-[#605e5c]">
              Create a loan for an employee, or wait for ESS applications. Approval
              requires an authorized officer (creator ≠ approver).
            </p>
          </div>
        ) : (
          <DataTable<EmployeeLoan>
            loading={loading}
            keyField="id"
            rows={loans}
            emptyMessage="No loans"
            columns={[
              {
                key: 'loanNumber',
                label: 'Loan #',
                render: (r) => (
                  <span className="font-mono text-xs">{r.loanNumber}</span>
                ),
              },
              {
                key: 'employeeId',
                label: 'Employee',
                render: (r) =>
                  employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
              },
              {
                key: 'principalAmount',
                label: 'Principal',
                render: (r) => (
                  <span className="text-xs tabular-nums">
                    {formatMoney(r.principalAmount)}
                  </span>
                ),
              },
              {
                key: 'termMonths',
                label: 'Term',
                render: (r) => (
                  <span className="text-xs">{r.termMonths} mo</span>
                ),
              },
              {
                key: 'monthlyInstallment',
                label: 'Installment',
                render: (r) => (
                  <span className="text-xs tabular-nums">
                    {formatMoney(r.monthlyInstallment)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'purpose',
                label: 'Purpose',
                render: (r) => (
                  <span
                    className="max-w-[160px] truncate text-xs text-[#605e5c]"
                    title={r.purpose}
                  >
                    {r.purpose}
                  </span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const pending = norm(r.status) === 'pending_approval';
                  const showSchedule = canShowSchedule(r.status);

                  if (!pending && !showSchedule) {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">—</span>
                    );
                  }

                  if (pending) {
                    const isOwn =
                      !!sessionUser?.id &&
                      !!r.createdBy &&
                      r.createdBy === sessionUser.id;
                    const isSuperAdmin =
                      sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;
                    if (isOwn && !isSuperAdmin) {
                      return (
                        <span className="text-[11px] text-[#a19f9d]">
                          Awaiting other approver
                        </span>
                      );
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id}
                          onClick={() => void onApprove(r.id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busyId === r.id}
                          onClick={() => setRejectTarget(r)}
                        >
                          Reject
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => setScheduleTarget(r)}
                    >
                      Schedule
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

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
  const [principalAmount, setPrincipalAmount] = useState('500000');
  const [termMonths, setTermMonths] = useState('6');
  const [interestRate, setInterestRate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateLoanBody = {
        employeeId,
        principalAmount: Number(principalAmount),
        termMonths: Number(termMonths),
        purpose: purpose.trim(),
      };
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
          Purpose
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Boots, uniform, emergency, salary advance…"
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
          No installments yet. Approve the loan to generate the schedule.
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
