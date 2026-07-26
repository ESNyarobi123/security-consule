'use client';

import {
  approveEmployeeMovement,
  createEmployeeMovement,
  listEmployeeMovements,
  listEmployees,
  rejectEmployeeMovement,
  type Employee,
  type EmployeeMovement,
  type MovementType,
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
import { ArrowLeftRight, Plus, RefreshCw } from 'lucide-react';
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

export default function HrMovementsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<EmployeeMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<EmployeeMovement | null>(
    null,
  );
  const sessionUser = useMemo(() => getSessionUser(), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, movements] = await Promise.all([
        listEmployees(),
        listEmployeeMovements(),
      ]);
      setEmployees(emps);
      setRows(movements);
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

  const onApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveEmployeeMovement(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HrShell
      title="Movements"
      description="Transfer and exit requests. Approve/reject pending items (creator ≠ approver)."
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
            onClick={() => setOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            New movement
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="p-4">
            <PanelEmpty
              icon={<ArrowLeftRight className="h-4 w-4" />}
              title="No movements"
              description="Request a transfer or exit for an employee."
            />
          </div>
        ) : (
          <DataTable<EmployeeMovement>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No movements"
            columns={[
              {
                key: 'employeeId',
                label: 'Employee',
                render: (r) =>
                  employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
              },
              {
                key: 'type',
                label: 'Type',
                render: (r) => <StatusBadge status={r.type} />,
              },
              {
                key: 'fromDepartment',
                label: 'From',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {r.fromDepartment ?? '—'}
                  </span>
                ),
              },
              {
                key: 'toDepartment',
                label: 'To',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {r.toDepartment ?? '—'}
                  </span>
                ),
              },
              {
                key: 'effectiveDate',
                label: 'Effective',
                render: (r) => formatDate(r.effectiveDate),
              },
              {
                key: 'reason',
                label: 'Reason',
                render: (r) => (
                  <span
                    className="max-w-[160px] truncate text-xs text-[#605e5c]"
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

      {open ? (
        <CreateMovementModal
          employees={employees}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectMovementModal
          movement={rejectTarget}
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
    </HrShell>
  );
}

function CreateMovementModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [type, setType] = useState<MovementType>('TRANSFER');
  const [toDepartment, setToDepartment] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = employees.find((e) => e.id === employeeId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (type === 'TRANSFER' && !toDepartment.trim()) {
      setError('Destination department is required for transfers.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createEmployeeMovement({
        employeeId,
        type,
        fromDepartment: selected?.department ?? undefined,
        toDepartment:
          type === 'TRANSFER' ? toDepartment.trim() : undefined,
        effectiveDate,
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
      title="New movement"
      description="Transfer or exit — starts the approval workflow."
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
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MovementType)}
              className={inputCls}
              required
            >
              <option value="TRANSFER">TRANSFER</option>
              <option value="EXIT">EXIT</option>
            </select>
          </label>
          {type === 'TRANSFER' ? (
            <label className="block text-sm font-medium text-[#323130] sm:col-span-2">
              To department
              <input
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className={inputCls}
                placeholder="Operations / Branch Arusha / …"
                required
              />
              {selected?.department ? (
                <span className="mt-1 block text-[11px] font-normal text-[#605e5c]">
                  From: {selected.department}
                </span>
              ) : null}
            </label>
          ) : null}
          <label className="block text-sm font-medium text-[#323130]">
            Effective date
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
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
            disabled={submitting || employees.length === 0}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectMovementModal({
  movement,
  employeeName,
  onClose,
  onRejected,
}: {
  movement: EmployeeMovement;
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
      await rejectEmployeeMovement(movement.id, reason.trim());
      await onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Reject movement"
      description={`${employeeName} · ${movement.type} · ${formatDate(movement.effectiveDate)}`}
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
