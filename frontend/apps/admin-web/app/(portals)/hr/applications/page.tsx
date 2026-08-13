'use client';

import {
  hireJobApplicant,
  listStaffJobApplications,
  updateJobApplicationStatus,
  type ApplicationStatusValue,
  type StaffJobApplication,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { RefreshCw, UserPlus } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { HrShell } from '../_components/HrShell';

const STATUSES: Array<'all' | ApplicationStatusValue> = [
  'all',
  'SUBMITTED',
  'SCREENING',
  'INTERVIEW',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];

const ACTION_LABEL: Partial<Record<ApplicationStatusValue, string>> = {
  SCREENING: 'Start screening',
  INTERVIEW: 'To interview',
  OFFERED: 'Make offer',
  REJECTED: 'Reject',
  WITHDRAWN: 'Withdraw',
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HrApplicationsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canManage =
    session?.roles?.includes('SUPER_ADMIN') ||
    session?.permissions?.includes('recruitment.manage');

  const [rows, setRows] = useState<StaffJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUSES)[number]>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hireTarget, setHireTarget] = useState<StaffJobApplication | null>(
    null,
  );
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<
    'GUARD' | 'SUPERVISOR' | 'ADMIN' | 'OTHER'
  >('GUARD');

  const refresh = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listStaffJobApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [canManage, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function advance(
    row: StaffJobApplication,
    next: ApplicationStatusValue,
  ) {
    setBusyId(row.id);
    setError(null);
    try {
      const note = notes[row.id]?.trim();
      await updateJobApplicationStatus(row.id, {
        status: next,
        notes: note || undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onHire(e: FormEvent) {
    e.preventDefault();
    if (!hireTarget) return;
    setBusyId(hireTarget.id);
    setError(null);
    try {
      await hireJobApplicant(hireTarget.id, {
        employeeNumber: employeeNumber.trim(),
        department: department.trim() || undefined,
        employmentType,
      });
      setHireTarget(null);
      setEmployeeNumber('');
      setDepartment('');
      setEmploymentType('GUARD');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <HrShell
      title="Applications"
      description="Module 14-A — internal recruitment inbox: screen → interview → offer → hire (Employee). GuardProfile convert deferred."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#8a8886] bg-white px-3 py-1.5 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      {!canManage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Requires <code className="text-xs">recruitment.manage</code> (HR
          officer / Super Admin).
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  statusFilter === s
                    ? 'bg-[#0078d4] text-white'
                    : 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9]'
                }`}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                {statusFilter === 'all' && s !== 'all' && counts[s]
                  ? ` (${counts[s]})`
                  : ''}
              </button>
            ))}
          </div>

          {error ? (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading applications…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-4 py-8 text-center text-sm text-[#605e5c]">
              No applications for this filter. Public careers posts feed this
              inbox.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const next = (row.allowedNextStatuses ?? []).filter(
                  (s) => s !== 'REJECTED' && s !== 'WITHDRAWN',
                );
                const terminals = (row.allowedNextStatuses ?? []).filter(
                  (s) => s === 'REJECTED' || s === 'WITHDRAWN',
                );
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-[#e1dfdd] bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#1b1a19]">
                          {row.applicantName}{' '}
                          <span className="font-mono text-xs font-medium text-[#0078d4]">
                            {row.referenceNumber}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#605e5c]">
                          {row.postingTitle ?? row.postingId.slice(0, 8)} ·{' '}
                          {row.email}
                          {row.phone ? ` · ${row.phone}` : ''}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8a8886]">
                          Applied {formatWhen(row.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          row.status === 'HIRED'
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : row.status === 'REJECTED' ||
                                row.status === 'WITHDRAWN'
                              ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                              : row.status === 'OFFERED'
                                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                : 'bg-[#deecf9] text-[#004578] ring-1 ring-[#c7e0f4]'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>

                    {row.coverLetter ? (
                      <p className="mt-2 line-clamp-2 text-xs text-[#605e5c]">
                        {row.coverLetter}
                      </p>
                    ) : null}
                    {row.notes ? (
                      <p className="mt-1 text-xs text-[#8a6914]">
                        Notes · {row.notes}
                      </p>
                    ) : null}
                    {row.employeeId ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Employee id · {row.employeeId}
                      </p>
                    ) : null}

                    {(row.allowedNextStatuses?.length || row.canHire) &&
                    row.status !== 'HIRED' ? (
                      <div className="mt-3 space-y-2 border-t border-[#f3f2f1] pt-3">
                        {(terminals.length > 0 ||
                          row.status === 'OFFERED') && (
                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a8886]">
                              Notes (required for reject/withdraw)
                            </span>
                            <input
                              value={notes[row.id] ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-[#e1dfdd] px-2.5 py-1.5 text-sm outline-none focus:border-[#0078d4]"
                              placeholder="HR notes…"
                            />
                          </label>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {next.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void advance(row, s)}
                              className="rounded-md bg-[#0078d4] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#106ebe] disabled:opacity-50"
                            >
                              {ACTION_LABEL[s] ?? s}
                            </button>
                          ))}
                          {row.canHire ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => {
                                setHireTarget(row);
                                setDepartment('');
                                setEmployeeNumber('');
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Hire
                            </button>
                          ) : null}
                          {terminals.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void advance(row, s)}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                            >
                              {ACTION_LABEL[s] ?? s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {hireTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1a19]/40 p-4">
          <form
            onSubmit={(ev) => void onHire(ev)}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="text-base font-semibold text-[#1b1a19]">
              Hire {hireTarget.applicantName}
            </h2>
            <p className="mt-1 text-xs text-[#605e5c]">
              Creates an Employee record and marks application HIRED. Guard
              profile / login link stays on Ops Guards.
            </p>
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Employee number *
              </span>
              <input
                required
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="GRD-00xx"
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Employment type
              </span>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(
                    e.target.value as typeof employmentType,
                  )
                }
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm"
              >
                <option value="GUARD">GUARD</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ADMIN">ADMIN</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Department
              </span>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#e1dfdd] px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHireTarget(null)}
                className="rounded-md border border-[#8a8886] px-3 py-1.5 text-xs font-medium text-[#323130]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === hireTarget.id}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirm hire
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </HrShell>
  );
}
