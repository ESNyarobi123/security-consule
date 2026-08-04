'use client';

import {
  approveLeaveRequest,
  createLeaveRequest,
  createLeaveType,
  listEmployees,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeaveRequest,
  type Employee,
  type LeaveRequest,
  type LeaveType,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { CalendarClock, Plus, RefreshCw, Search } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LeaveRequestRoster } from '../_components/HrRosters';
import { HrShell } from '../_components/HrShell';
import { PanelEmpty, formatDate } from '../_components/shared';

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

export default function HrLeavePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, leaveTypes, reqs] = await Promise.all([
        listEmployees(),
        listLeaveTypes(),
        listLeaveRequests(),
      ]);
      setEmployees(emps);
      setTypes(leaveTypes);
      setRequests(reqs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

  const leaveTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of types) map.set(t.id, t.name);
    return map;
  }, [types]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      const st = norm(r.status);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (!q) return true;
      const name = (employeeName.get(r.employeeId) ?? '').toLowerCase();
      const type = (leaveTypeName.get(r.leaveTypeId) ?? '').toLowerCase();
      return (
        name.includes(q) ||
        type.includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  }, [requests, query, statusFilter, employeeName, leaveTypeName]);

  const onApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveLeaveRequest(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HrShell
      title="Leave"
      description="Leave types and requests. Approve/reject pending items (creator ≠ approver)."
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
            onClick={() => setTypeOpen(true)}
            className={btnSecondary}
          >
            <Plus className="h-3.5 w-3.5" />
            Leave type
          </button>
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            Apply leave
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <section className="mb-6">
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#1b1a19]">
            Leave types
          </h2>
          <span className="inline-flex rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
            {types.length}
          </span>
        </div>
        {types.length === 0 && !loading ? (
          <PanelEmpty
            icon={<CalendarClock className="h-4 w-4" />}
            title="No leave types"
            description="Create annual, sick, or other leave categories first."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-[#e1dfdd] bg-gradient-to-br from-white to-[#f8fafc] px-3.5 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-[#1b1a19]">{t.name}</p>
                <p className="mt-1 font-mono text-[11px] text-[#605e5c]">
                  {t.code}
                </p>
                <p className="mt-2 inline-flex rounded-md bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold text-[#0067b8]">
                  {t.annualQuotaDays} days / year
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#1b1a19]">Requests</h2>
          <span className="inline-flex rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
            {requests.length}
          </span>
        </div>
        <LeaveRequestRoster
          rows={filteredRequests}
          loading={loading}
          employeeName={employeeName}
          leaveTypeName={leaveTypeName}
          busyId={busyId}
          onApprove={(id) => void onApprove(id)}
          onReject={setRejectTarget}
          canAct={(r) => {
            if (norm(r.status) !== 'pending') return false;
            const isOwn =
              !!sessionUser?.id &&
              !!r.createdBy &&
              r.createdBy === sessionUser.id;
            const isSuperAdmin =
              sessionUser?.roles?.includes('SUPER_ADMIN') ?? false;
            if (isOwn && !isSuperAdmin) return 'own';
            const required = r.approvalRequiredRole;
            if (
              required &&
              required !== '*' &&
              !isSuperAdmin &&
              !(sessionUser?.roles ?? []).includes(required)
            ) {
              return false;
            }
            return true;
          }}
          toolbar={
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee, type, reason…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['pending', 'Pending'],
                    ['approved', 'Approved'],
                    ['rejected', 'Rejected'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatusFilter(id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      statusFilter === id
                        ? 'bg-[#0078d4] text-white'
                        : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          }
          empty={
            <PanelEmpty
              icon={<CalendarClock className="h-4 w-4" />}
              title={requests.length === 0 ? 'No leave requests' : 'No matches'}
              description={
                requests.length === 0
                  ? 'Apply for leave once types and employees exist.'
                  : 'Try another search or status filter.'
              }
            />
          }
        />
      </section>

      {typeOpen ? (
        <CreateLeaveTypeModal
          onClose={() => setTypeOpen(false)}
          onCreated={async () => {
            setTypeOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {applyOpen ? (
        <ApplyLeaveModal
          employees={employees}
          types={types}
          onClose={() => setApplyOpen(false)}
          onCreated={async () => {
            setApplyOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectLeaveModal
          request={rejectTarget}
          employeeName={
            employeeName.get(rejectTarget.employeeId) ?? rejectTarget.employeeId
          }
          onClose={() => setRejectTarget(null)}
          onRejected={async () => {
            setRejectTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </HrShell>
  );
}

function CreateLeaveTypeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('21');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createLeaveType({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        annualQuotaDays: Number(quota) || 21,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New leave type"
      description="Quota is annual days per employee for this category."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputCls}
            placeholder="ANNUAL"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="Annual Leave"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Annual quota (days)
          <input
            type="number"
            min={1}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className={inputCls}
            required
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
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ApplyLeaveModal({
  employees,
  types,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  types: LeaveType[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createLeaveRequest({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        days: Number(days),
        reason: reason.trim(),
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Apply for leave"
      description="Starts the leave-approval workflow."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
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
            Leave type
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={inputCls}
              required
            >
              {types.length === 0 ? (
                <option value="">No leave types</option>
              ) : (
                types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Days
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputCls}
              required
            />
          </label>
        </div>
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
          <button
            type="submit"
            className={btnPrimary}
            disabled={
              submitting || employees.length === 0 || types.length === 0
            }
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectLeaveModal({
  request,
  employeeName,
  onClose,
  onRejected,
}: {
  request: LeaveRequest;
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
      await rejectLeaveRequest(request.id, reason.trim());
      await onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Reject leave"
      description={`${employeeName} · ${formatDate(request.startDate)} → ${formatDate(request.endDate)}`}
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
