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
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { ArrowLeftRight, Plus, RefreshCw, Search } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MovementRoster } from '../_components/HrRosters';
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
  const [query, setQuery] = useState('');
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (employeeName.get(r.employeeId) ?? '').toLowerCase();
      return (
        name.includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.fromDepartment ?? '').toLowerCase().includes(q) ||
        (r.toDepartment ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, employeeName]);

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
      description="Transfer, promotion, exit, and redundancy. Approve/reject pending items (creator ≠ approver). Exit and redundancy terminate employment and end active guard deployments."
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

      <MovementRoster
        rows={filtered}
        loading={loading}
        employeeName={employeeName}
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
          return true;
        }}
        toolbar={
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
            <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee, type, dept, reason…"
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
            />
          </label>
        }
        empty={
          <PanelEmpty
            icon={<ArrowLeftRight className="h-4 w-4" />}
            title={rows.length === 0 ? 'No movements' : 'No matches'}
            description={
              rows.length === 0
                ? 'Request a transfer, promotion, exit, or redundancy.'
                : 'Try another search.'
            }
          />
        }
      />

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
    if (
      (type === 'TRANSFER' || type === 'PROMOTION') &&
      !toDepartment.trim()
    ) {
      setError(
        type === 'PROMOTION'
          ? 'New department / role is required for promotions.'
          : 'Destination department is required for transfers.',
      );
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
          type === 'TRANSFER' || type === 'PROMOTION'
            ? toDepartment.trim()
            : undefined,
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
      description="Transfer, promotion, exit, or redundancy — starts the approval workflow."
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
              <option value="PROMOTION">PROMOTION</option>
              <option value="EXIT">EXIT</option>
              <option value="REDUNDANCY">REDUNDANCY</option>
            </select>
          </label>
          {type === 'TRANSFER' || type === 'PROMOTION' ? (
            <label className="block text-sm font-medium text-[#323130] sm:col-span-2">
              {type === 'PROMOTION' ? 'To department / role' : 'To department'}
              <input
                value={toDepartment}
                onChange={(e) => setToDepartment(e.target.value)}
                className={inputCls}
                placeholder={
                  type === 'PROMOTION'
                    ? 'New department or role title'
                    : 'Operations / Branch Arusha / …'
                }
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
