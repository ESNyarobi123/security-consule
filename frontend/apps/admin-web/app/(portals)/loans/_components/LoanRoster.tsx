'use client';

import type { EmployeeLoan } from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import { CalendarClock, Coins } from 'lucide-react';
import type { ReactNode } from 'react';

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

const AVATAR = [
  '#0078d4',
  '#0d9488',
  '#7c3aed',
  '#ea580c',
  '#059669',
  '#0284c7',
  '#c026d3',
  '#b45309',
] as const;

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

function loanStatusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'PENDING_APPROVAL' || s === 'DRAFT')
    return {
      label: s === 'DRAFT' ? 'Draft' : 'Pending approval',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED')
    return {
      label: 'Approved',
      className: 'bg-violet-50 text-violet-800 ring-violet-200/80',
      dot: 'bg-violet-500',
    };
  if (s === 'ACTIVE')
    return {
      label: 'Active',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (s === 'COMPLETED')
    return {
      label: 'Completed',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'REJECTED' || s === 'CANCELLED')
    return {
      label: s === 'REJECTED' ? 'Rejected' : 'Cancelled',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function StatusPill({ status }: { status: string }) {
  const tone = loanStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

export function LoanRoster({
  rows,
  loading,
  employeeName,
  busyId,
  canAct,
  canIssue,
  onApprove,
  onReject,
  onSchedule,
  onIssue,
  onStatement,
  toolbar,
  empty,
}: {
  rows: EmployeeLoan[];
  loading?: boolean;
  employeeName: Map<string, string>;
  busyId?: string | null;
  canAct?: (r: EmployeeLoan) => boolean | 'own';
  canIssue?: (r: EmployeeLoan) => boolean | 'own';
  onApprove?: (id: string) => void;
  onReject?: (r: EmployeeLoan) => void;
  onSchedule?: (r: EmployeeLoan) => void;
  onIssue?: (r: EmployeeLoan) => void;
  onStatement?: (r: EmployeeLoan) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto_auto]';

  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      <div
        className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${grid}`}
      >
        <span>Employee</span>
        <span>Loan</span>
        <span>Principal</span>
        <span>Installment</span>
        <span>Purpose / item</span>
        <span>Status</span>
        <span className="text-right"> </span>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="animate-pulse px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#edebe9]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-[#edebe9]" />
                  <div className="h-2.5 w-28 rounded bg-[#f3f2f1]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <ul className="divide-y divide-[#f3f2f1]">
          {rows.map((r) => {
            const name =
              employeeName.get(r.employeeId) ??
              `Employee ${r.employeeId.slice(0, 8)}`;
            const bg = avatarColor(r.employeeId);
            const act = canAct?.(r);
            const issueAct = canIssue?.(r);
            const s = r.status.trim().toUpperCase().replace(/[\s-]+/g, '_');
            const showSchedule = s === 'ACTIVE' || s === 'COMPLETED';
            const showIssue = s === 'APPROVED';
            const showStatement =
              s === 'ACTIVE' || s === 'COMPLETED' || s === 'APPROVED';
            const purposeLine =
              r.itemName?.trim() ||
              r.purpose?.trim() ||
              r.loanType?.replace(/_/g, ' ') ||
              '—';

            return (
              <li key={r.id}>
                <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
                  {/* Mobile */}
                  <div className="space-y-2.5 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                              {r.loanNumber}
                            </p>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="mt-2 text-[15px] font-semibold tabular-nums text-[#1b1a19]">
                          {formatMoney(r.principalAmount)}
                        </p>
                        <p className="text-[11px] text-[#8a8886]">
                          {r.termMonths} mo ·{' '}
                          {formatMoney(r.monthlyInstallment)} / month
                        </p>
                        {purposeLine !== '—' ? (
                          <p
                            className="mt-1 truncate text-[12px] text-[#605e5c]"
                            title={purposeLine}
                          >
                            {purposeLine}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <LoanActions
                      act={act}
                      issueAct={issueAct}
                      showSchedule={showSchedule}
                      showIssue={showIssue}
                      showStatement={showStatement}
                      busy={busyId === r.id}
                      onApprove={() => onApprove?.(r.id)}
                      onReject={() => onReject?.(r)}
                      onSchedule={() => onSchedule?.(r)}
                      onIssue={() => onIssue?.(r)}
                      onStatement={() => onStatement?.(r)}
                    />
                  </div>

                  {/* Desktop */}
                  <div
                    className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8a8886]">
                          {r.interestRate
                            ? `${r.interestRate}% interest`
                            : 'Employee loan'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-mono text-[12px] font-semibold text-[#323130]">
                        {r.loanNumber}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#a19f9d]">
                        {r.termMonths} months
                      </p>
                    </div>

                    <span className="text-[13px] font-semibold tabular-nums text-[#1b1a19]">
                      {formatMoney(r.principalAmount)}
                    </span>

                    <span className="inline-flex w-fit rounded-lg bg-[#f3f2f1] px-2 py-1 text-[12px] font-semibold tabular-nums text-[#323130]">
                      {formatMoney(r.monthlyInstallment)}
                    </span>

                    <p
                      className="truncate text-[12px] text-[#605e5c]"
                      title={purposeLine}
                    >
                      {purposeLine}
                    </p>

                    <StatusPill status={r.status} />

                    <div className="flex flex-wrap justify-end gap-1">
                      <LoanActions
                        act={act}
                        issueAct={issueAct}
                        showSchedule={showSchedule}
                        showIssue={showIssue}
                        showStatement={showStatement}
                        busy={busyId === r.id}
                        onApprove={() => onApprove?.(r.id)}
                        onReject={() => onReject?.(r)}
                        onSchedule={() => onSchedule?.(r)}
                        onIssue={() => onIssue?.(r)}
                        onStatement={() => onStatement?.(r)}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LoanActions({
  act,
  issueAct,
  showSchedule,
  showIssue,
  showStatement,
  busy,
  onApprove,
  onReject,
  onSchedule,
  onIssue,
  onStatement,
}: {
  act?: boolean | 'own';
  issueAct?: boolean | 'own';
  showSchedule?: boolean;
  showIssue?: boolean;
  showStatement?: boolean;
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSchedule: () => void;
  onIssue: () => void;
  onStatement: () => void;
}) {
  if (act === true) {
    return (
      <>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={onApprove}
        >
          Approve
        </button>
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </button>
      </>
    );
  }
  if (act === 'own') {
    return (
      <span className="text-[11px] text-[#a19f9d]">Awaiting other approver</span>
    );
  }
  if (showIssue) {
    if (issueAct === 'own') {
      return (
        <span className="text-[11px] text-[#a19f9d]">
          Awaiting other officer to issue
        </span>
      );
    }
    return (
      <>
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={onIssue}
        >
          Issue
        </button>
        {showStatement ? (
          <button type="button" className={btnSecondary} onClick={onStatement}>
            Statement
          </button>
        ) : null}
      </>
    );
  }
  if (showSchedule) {
    return (
      <>
        <button type="button" className={btnSecondary} onClick={onSchedule}>
          <CalendarClock className="h-3 w-3" />
          Schedule
        </button>
        {showStatement ? (
          <button type="button" className={btnSecondary} onClick={onStatement}>
            Statement
          </button>
        ) : null}
      </>
    );
  }
  if (showStatement) {
    return (
      <button type="button" className={btnSecondary} onClick={onStatement}>
        Statement
      </button>
    );
  }
  return <span className="text-[11px] text-[#c8c6c4]">—</span>;
}

export function LoansEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <Coins className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
