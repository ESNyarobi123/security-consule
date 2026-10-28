'use client';

import {
  applyMyPayrollLeave,
  getMyPayrollLoanBalance,
  getMyPayrollProfile,
  listMyPayrollLeaveBalances,
  listMyPayrollLeaveRequests,
  listMyPayrollLeaveTypes,
  listMyPayrollPayslips,
  type EssLeaveBalance,
  type EssLeaveRequest,
  type EssLeaveType,
  type EssLoanBalance,
  type EssProfile,
  type MyPayrollPayslip,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Banknote,
  CalendarDays,
  FileSpreadsheet,
  Loader,
  RefreshCw,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PanelEmpty,
  formatDate,
  formatMoney,
} from '../../ess/_components/shared';

function isProfileMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('PAYROLL_PROFILE_MISSING') ||
    msg.includes('PAYROLL_PROFILE_AMBIGUOUS') ||
    msg.includes('ESS_PROFILE_MISSING')
  );
}

function inclusiveDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Portal 35.16 — non-admin payroll surface.
 *
 * Self-scoped only: the employee's own immutable payslips, profile, loan
 * balance and leave. There is no company/customer payroll data on this page.
 */
export function MyPayroll() {
  const [payslips, setPayslips] = useState<MyPayrollPayslip[]>([]);
  const [profile, setProfile] = useState<EssProfile | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<EssLeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<EssLeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<EssLeaveType[]>([]);
  const [loanBalance, setLoanBalance] = useState<EssLoanBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [detail, setDetail] = useState<MyPayrollPayslip | null>(null);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const rows = await listMyPayrollPayslips();
      setPayslips(rows);
    } catch (err) {
      if (isProfileMissing(err)) {
        setMissing(true);
        setPayslips([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      setLoading(false);
      return;
    }

    // Companion self-service data comes from payroll-owned endpoints, so it
    // works without `ess.access`. A failure here must never hide the payslips.
    const [me, loans, balances, requests, types] = await Promise.allSettled([
      getMyPayrollProfile(),
      getMyPayrollLoanBalance(),
      listMyPayrollLeaveBalances(),
      listMyPayrollLeaveRequests(),
      listMyPayrollLeaveTypes(),
    ]);
    if (me.status === 'fulfilled') setProfile(me.value);
    if (loans.status === 'fulfilled') setLoanBalance(loans.value);
    if (balances.status === 'fulfilled') setLeaveBalances(balances.value);
    if (requests.status === 'fulfilled') setLeaveRequests(requests.value);
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const ytd = payslips.filter(
      (p) => new Date(p.periodStart).getFullYear() === year,
    );
    const eligible = ytd.filter((p) =>
      ['APPROVED', 'PAID'].includes(p.cycleStatus),
    );
    const sum = (rows: MyPayrollPayslip[], key: 'grossPay' | 'netPay' | 'totalDeductions') =>
      rows.reduce((total, row) => total + (row[key] ?? 0), 0);
    const latest = payslips[0] ?? null;
    return {
      latest,
      ytdNet: sum(eligible, 'netPay'),
      ytdGross: sum(eligible, 'grossPay'),
      ytdDeductions: sum(eligible, 'totalDeductions'),
      ytdCount: eligible.length,
    };
  }, [payslips]);

  async function submitLeave(e: FormEvent) {
    e.preventDefault();
    const days = inclusiveDays(leaveFrom, leaveTo);
    if (!leaveTypeId) {
      setLeaveError('Select a leave type');
      return;
    }
    if (days < 1) {
      setLeaveError('Choose a valid start and end date');
      return;
    }
    if (!leaveReason.trim()) {
      setLeaveError('Add a short reason');
      return;
    }
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      await applyMyPayrollLeave({
        leaveTypeId,
        startDate: leaveFrom,
        endDate: leaveTo,
        days,
        reason: leaveReason.trim(),
      });
      setShowLeave(false);
      setLeaveTypeId('');
      setLeaveFrom('');
      setLeaveTo('');
      setLeaveReason('');
      await load();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Could not submit leave');
    } finally {
      setLeaveBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl">
        <PanelEmpty
          icon={<UserRound className="h-4 w-4" />}
          title="No employee profile linked to this login"
          description="Internal staff logins get a payroll profile automatically on first view. External accounts (customer, supplier, contractor, consultant) are never part of company payroll — this page stays empty for them."
        />
        <p className="mt-3 text-center text-xs text-[#605e5c]">
          If your email is already on file, ask HR to confirm it matches this
          login. No admin approval is needed after that — it links on first view.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5c2d91]">
            Portal 35.16 · Payroll
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            My payslips
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Your own immutable payslip snapshots, leave balance and loan
            position. You will never see another employee&apos;s pay here —
            payroll officers use the console view.
          </p>
        </div>
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

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest net pay"
          value={stats.latest ? formatMoney(stats.latest.netPay) : '—'}
          hint={
            stats.latest
              ? `${stats.latest.cycleCode} · ${formatDate(stats.latest.periodEnd)}`
              : loading
                ? 'Loading…'
                : 'No payslip yet'
          }
          icon={<Wallet className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Net paid YTD"
          value={formatMoney(stats.ytdNet)}
          hint={`${stats.ytdCount} approved/paid slip${stats.ytdCount === 1 ? '' : 's'} this year`}
          icon={<Banknote className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Deductions YTD"
          value={formatMoney(stats.ytdDeductions)}
          hint={`Gross ${formatMoney(stats.ytdGross)}`}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Loan outstanding"
          value={
            loanBalance ? formatMoney(loanBalance.outstandingBalance) : '—'
          }
          hint={
            loanBalance
              ? `${loanBalance.activeLoanCount} active · ${loanBalance.pendingLoanCount} pending`
              : 'Not available'
          }
          icon={<Loader className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <section>
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Payslip history
            </h2>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Frozen snapshots — attendance changes after generation never edit
              these amounts. Profile, leave and loan position load for every
              employee automatically; no extra permission is required.
            </p>
          </div>
        </div>
        <GlassCard className="!p-0 overflow-hidden">
          {payslips.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Banknote className="h-4 w-4" />}
                title="No payslips yet"
                description="Your profile is linked, but no payroll cycle has produced a payslip for you. If your salary terms are not set yet, ask HR or Payroll to add them under HR → Salary."
              />
            </div>
          ) : (
            <DataTable<MyPayrollPayslip>
              loading={loading}
              keyField="id"
              rows={payslips}
              emptyMessage="No payslips"
              columns={[
                {
                  key: 'periodStart',
                  label: 'Period',
                  render: (r) => (
                    <span className="whitespace-nowrap text-[12px]">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </span>
                  ),
                },
                {
                  key: 'cycleCode',
                  label: 'Cycle',
                  render: (r) => (
                    <span className="font-mono text-[11px] text-[#605e5c]">
                      {r.cycleCode}
                    </span>
                  ),
                },
                {
                  key: 'cycleStatus',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.cycleStatus} />,
                },
                {
                  key: 'grossPay',
                  label: 'Gross',
                  render: (r) => formatMoney(r.grossPay),
                },
                {
                  key: 'totalDeductions',
                  label: 'Deductions',
                  render: (r) => formatMoney(r.totalDeductions),
                },
                {
                  key: 'netPay',
                  label: 'Net',
                  render: (r) => (
                    <span className="font-medium text-[#1b1a19]">
                      {formatMoney(r.netPay)}
                    </span>
                  ),
                },
                {
                  key: 'id',
                  label: '',
                  render: (r) => (
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="text-[12px] font-semibold text-[#0067b8] hover:underline"
                    >
                      View
                    </button>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-[#0078d4]" />
            <p className="text-sm font-semibold text-[#1b1a19]">My profile</p>
          </div>
          {profile ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <div>
                <dt className="text-[#8a8886]">Employee</dt>
                <dd className="font-medium text-[#323130]">
                  {profile.fullName} · {profile.employeeNumber}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8886]">Department</dt>
                <dd className="font-medium text-[#323130]">
                  {profile.department || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8886]">Employment</dt>
                <dd className="font-medium text-[#323130]">
                  {profile.employmentType.replace(/_/g, ' ').toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8886]">Status</dt>
                <dd className="font-medium text-[#323130]">
                  {profile.status.replace(/_/g, ' ').toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8886]">Hired</dt>
                <dd className="font-medium text-[#323130]">
                  {formatDate(profile.hireDate)}
                </dd>
              </div>
              <div>
                <dt className="text-[#8a8886]">Work email</dt>
                <dd className="truncate font-medium text-[#323130]">
                  {profile.email || '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-xs text-[#605e5c]">
              {loading ? 'Loading…' : 'Profile could not be loaded.'}
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#0078d4]" />
              <p className="text-sm font-semibold text-[#1b1a19]">
                Leave balance
              </p>
            </div>
            {leaveTypes.length > 0 ? (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setLeaveError(null);
                  setShowLeave(true);
                }}
              >
                Request leave
              </button>
            ) : null}
          </div>
          {leaveBalances.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {leaveBalances.map((b) => (
                <li
                  key={b.leaveTypeId}
                  className="flex items-center justify-between gap-2 rounded-md border border-[#edebe9] px-2.5 py-1.5 text-[12px]"
                >
                  <span className="text-[#323130]">{b.name}</span>
                  <span className="tabular-nums text-[#605e5c]">
                    {b.remainingDays} / {b.annualQuotaDays} days left
                    {b.pendingDays > 0 ? ` · ${b.pendingDays} pending` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[#605e5c]">
              {loading ? 'Loading…' : 'No leave balances available.'}
            </p>
          )}
          {leaveRequests.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Recent requests
              </p>
              <ul className="mt-1 space-y-1 text-[12px]">
                {leaveRequests.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-[#323130]">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)} · {r.days}d
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>
      </div>

      {detail ? (
        <Modal
          title="Payslip"
          description={`${detail.employeeName} · ${detail.employeeNumber} · ${detail.cycleCode}`}
          onClose={() => setDetail(null)}
          size="lg"
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Gross</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(detail.grossPay)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Deductions</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(detail.totalDeductions)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Net pay</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-700">
                {formatMoney(detail.netPay)}
              </p>
            </div>
          </div>
          <p className="mb-2 text-[12px] text-[#605e5c]">
            Period {formatDate(detail.periodStart)} – {formatDate(detail.periodEnd)}{' '}
            · cycle {detail.cycleCode} · <StatusBadge status={detail.cycleStatus} />
          </p>
          {(detail.calculationResult?.lines?.length ?? 0) > 0 ? (
            <div className="max-h-[320px] overflow-auto rounded border border-[#e1dfdd]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.calculationResult!.lines!.map((line) => (
                    <tr
                      key={`${line.code}-${line.label}`}
                      className="border-t border-[#edebe9]"
                    >
                      <td className="px-3 py-2 font-mono">{line.code}</td>
                      <td className="px-3 py-2">{line.label}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={line.type} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#605e5c]">
              Line items are not available for this snapshot.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className={btnSecondary}
            >
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </Modal>
      ) : null}

      {showLeave ? (
        <Modal
          title="Request leave"
          description="Starts the normal approval chain — you cannot approve your own request."
          onClose={() => setShowLeave(false)}
        >
          <form onSubmit={submitLeave} className="space-y-4">
            <label className="block text-sm font-medium text-[#323130]">
              Leave type
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select…</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#323130]">
                Start
                <input
                  type="date"
                  value={leaveFrom}
                  onChange={(e) => setLeaveFrom(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
              <label className="block text-sm font-medium text-[#323130]">
                End
                <input
                  type="date"
                  value={leaveTo}
                  onChange={(e) => setLeaveTo(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
            </div>
            <p className="text-[12px] text-[#605e5c]">
              {inclusiveDays(leaveFrom, leaveTo)} day(s)
            </p>
            <label className="block text-sm font-medium text-[#323130]">
              Reason
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className={`${inputCls} min-h-[70px]`}
                required
              />
            </label>
            {leaveError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {leaveError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLeave(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={leaveBusy} className={btnPrimary}>
                {leaveBusy ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
