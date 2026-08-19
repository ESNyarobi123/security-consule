'use client';

import {
  getEssLoanBalance,
  getEssMe,
  listEssApprovals,
  listEssAttendance,
  listEssLeaveBalances,
  listEssNotices,
  listEssRequests,
  listEssTraining,
  type EssLeaveBalance,
  type EssLoanBalance,
  type EssProfile,
} from '@pssms/api-client';
import { GlassCard, StatCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from './_components/EssShell';
import {
  PanelEmpty,
  QuickLink,
  formatDate,
  formatMoney,
  isEssProfileMissing,
} from './_components/shared';

export default function EssOverviewPage() {
  const [profile, setProfile] = useState<EssProfile | null>(null);
  const [leave, setLeave] = useState<EssLeaveBalance[]>([]);
  const [loans, setLoans] = useState<EssLoanBalance | null>(null);
  const [attendanceNote, setAttendanceNote] = useState<string | null>(null);
  const [trainingCount, setTrainingCount] = useState(0);
  const [noticeCount, setNoticeCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [waitingOnMe, setWaitingOnMe] = useState(0);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const me = await getEssMe();
      setProfile(me);
      const [
        balances,
        loanBal,
        attendance,
        training,
        notices,
        requests,
        approvals,
      ] = await Promise.all([
        listEssLeaveBalances().catch(() => [] as EssLeaveBalance[]),
        getEssLoanBalance().catch(() => null),
        listEssAttendance().catch(() => null),
        listEssTraining().catch(() => []),
        listEssNotices().catch(() => []),
        listEssRequests().catch(() => []),
        listEssApprovals().catch(() => []),
      ]);
      setLeave(balances);
      setLoans(loanBal);
      setAttendanceNote(
        attendance
          ? `${attendance.source === 'GUARD' ? attendance.rows.length : 0} clock records`
          : null,
      );
      setTrainingCount(training.length);
      setNoticeCount(notices.length);
      setPendingRequests(
        requests.filter((r) =>
          /pending|approval/i.test(String(r.status)),
        ).length,
      );
      setWaitingOnMe(approvals.filter((a) => !a.mine && a.status === 'PENDING').length);
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setProfile(null);
        setMissing(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remainingLeave = leave.reduce((s, b) => s + b.remainingDays, 0);

  return (
    <EssShell
      title="Employee Self-Service"
      description="For all employees with a linked HR profile. View your record, leave and loan balances, payslips, equipment, training, notices, and request status. You cannot approve your own requests."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          {loading ? '…' : 'Refresh'}
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<UserX className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login. Contact HR so they can connect your user account to an employee record."
        />
      ) : null}

      {!missing && profile ? (
        <>
          <GlassCard className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  Profile
                </p>
                <p className="mt-1 text-base font-semibold text-[#1b1a19]">
                  {profile.fullName}
                </p>
                <p className="mt-0.5 font-mono text-xs text-[#605e5c]">
                  {profile.employeeNumber}
                  {profile.department ? ` · ${profile.department}` : ''}
                </p>
              </div>
              <StatusBadge status={profile.status} />
            </div>
            <p className="mt-2 text-[11px] text-[#605e5c]">
              Hired {formatDate(profile.hireDate)}
              {profile.guardProfileId ? ' · Guard profile linked' : ''}
            </p>
          </GlassCard>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Leave remaining"
              value={loading ? '…' : remainingLeave}
              hint="Days this year after pending"
              accent="blue"
            />
            <StatCard
              label="Loan outstanding"
              value={
                loading
                  ? '…'
                  : formatMoney(loans?.outstandingBalance ?? 0)
              }
              hint={`${loans?.activeLoanCount ?? 0} active · ${loans?.pendingLoanCount ?? 0} pending`}
              accent="amber"
            />
            <StatCard
              label="Open requests"
              value={loading ? '…' : pendingRequests}
              hint="Leave, loan, movement, petty cash"
              accent={pendingRequests > 0 ? 'amber' : 'slate'}
            />
            <StatCard
              label="Waiting on me"
              value={loading ? '…' : waitingOnMe}
              hint="Act on /approvals — creator ≠ approver"
              accent={waitingOnMe > 0 ? 'amber' : 'slate'}
            />
          </div>

          <section className="mb-6">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Coverage
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <QuickLink
                href="/ess/profile"
                label="Profile"
                hint="Your employee record"
                glyph="user-check"
              />
              <QuickLink
                href="/ess/attendance"
                label="Attendance"
                hint={attendanceNote ?? 'Guard clock if linked'}
                glyph="calendar"
              />
              <QuickLink
                href="/ess/payslips"
                label="Payslips"
                hint="Immutable snapshots"
                glyph="wallet"
              />
              <QuickLink
                href="/ess/leave"
                label="Leave balance"
                hint={`${remainingLeave} days remaining`}
                glyph="calendar"
              />
              <QuickLink
                href="/ess/loans"
                label="Loans"
                hint="Boots, phone, cash, uniform, advance"
                glyph="coins"
              />
              <QuickLink
                href="/ess/equipment"
                label="Assigned equipment"
                hint="Assets on your profile"
                glyph="box"
              />
              <QuickLink
                href="/ess/notices"
                label="Notices"
                hint={`${noticeCount} messages to you`}
                glyph="megaphone"
              />
              <QuickLink
                href="/ess/training"
                label="Training"
                hint={`${trainingCount} records`}
                glyph="book"
              />
              <QuickLink
                href="/ess/requests"
                label="Requests"
                hint="Status of what you submitted"
                glyph="clipboard"
              />
              <QuickLink
                href="/ess/approvals"
                label="Approvals"
                hint="Yours, plus queue if you may act"
                glyph="check-circle"
              />
            </div>
          </section>
        </>
      ) : null}

      {!missing && !profile && !loading && !error ? (
        <PanelEmpty
          icon={<UserX className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : null}
    </EssShell>
  );
}
