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
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { CalendarClock, Plus, RefreshCw } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Leave types ({types.length})
        </h2>
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
                className="rounded-lg border border-[#e1dfdd] bg-white px-3 py-2.5 shadow-sm"
              >
                <p className="text-sm font-medium text-[#1b1a19]">{t.name}</p>
                <p className="font-mono text-[11px] text-[#605e5c]">
                  {t.code} · {t.annualQuotaDays} days / year
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Requests ({requests.length})
        </h2>
        <GlassCard className="!p-0 overflow-hidden">
          {requests.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<CalendarClock className="h-4 w-4" />}
                title="No leave requests"
                description="Apply for leave once types and employees exist."
              />
            </div>
          ) : (
            <DataTable<LeaveRequest>
              loading={loading}
              keyField="id"
              rows={requests}
              emptyMessage="No leave requests"
              columns={[
                {
                  key: 'employeeId',
                  label: 'Employee',
                  render: (r) =>
                    employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
                },
                {
                  key: 'leaveTypeId',
                  label: 'Type',
                  render: (r) => leaveTypeName.get(r.leaveTypeId) ?? '—',
                },
                {
                  key: 'startDate',
                  label: 'From',
                  render: (r) => formatDate(r.startDate),
                },
                {
                  key: 'endDate',
                  label: 'To',
                  render: (r) => formatDate(r.endDate),
                },
                {
                  key: 'days',
                  label: 'Days',
                  render: (r) => <span className="text-xs">{r.days}</span>,
                },
                {
                  key: 'reason',
                  label: 'Reason',
                  render: (r) => (
                    <span
                      className="max-w-[180px] truncate text-xs text-[#605e5c]"
                      title={r.reason}
                    >
                      {r.reason}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: 'id',
                  label: '',
                  render: (r) => {
                    const pending = norm(r.status) === 'pending';
                    if (!pending) {
                      return r.rejectedReason ? (
                        <span
                          className="max-w-[120px] truncate text-[11px] text-rose-700"
                          title={r.rejectedReason}
                        >
                          {r.rejectedReason}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#a19f9d]">—</span>
                      );
                    }
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
                  },
                },
              ]}
            />
          )}
        </GlassCard>
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
