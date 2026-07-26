'use client';

import {
  createSalaryAssignment,
  listEmployees,
  listSalaryAssignments,
  type Employee,
  type SalaryAssignment,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Banknote, Plus, RefreshCw } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { HrShell } from '../_components/HrShell';
import { PanelEmpty, formatDate, formatMoney } from '../_components/shared';

export default function HrSalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<SalaryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, assignments] = await Promise.all([
        listEmployees(),
        listSalaryAssignments(),
      ]);
      setEmployees(emps);
      setRows(assignments);
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

  return (
    <HrShell
      title="Salary assignments"
      description="Basic salary used by payroll cycles. Payslips and bank files live under Payroll."
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
            Assign salary
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
              icon={<Banknote className="h-4 w-4" />}
              title="No salary assignments"
              description="Assign basic salary before running payroll."
            />
          </div>
        ) : (
          <DataTable<SalaryAssignment>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No salary assignments"
            columns={[
              {
                key: 'employeeId',
                label: 'Employee',
                render: (r) =>
                  employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
              },
              {
                key: 'basicSalary',
                label: 'Basic',
                render: (r) => (
                  <span className="font-medium text-[#1b1a19]">
                    {formatMoney(r.basicSalary, r.currency)}
                  </span>
                ),
              },
              {
                key: 'currency',
                label: 'Currency',
                render: (r) => (
                  <span className="font-mono text-xs">{r.currency}</span>
                ),
              },
              {
                key: 'hourlyRate',
                label: 'Hourly',
                render: (r) =>
                  r.hourlyRate != null
                    ? formatMoney(r.hourlyRate, r.currency)
                    : '—',
              },
              {
                key: 'effectiveFrom',
                label: 'From',
                render: (r) => formatDate(r.effectiveFrom),
              },
              {
                key: 'effectiveUntil',
                label: 'Until',
                render: (r) => formatDate(r.effectiveUntil),
              },
              {
                key: 'isActive',
                label: 'Status',
                render: (r) => (
                  <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                ),
              },
            ]}
          />
        )}
      </GlassCard>

      {open ? (
        <AssignSalaryModal
          employees={employees}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </HrShell>
  );
}

function AssignSalaryModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [basicSalary, setBasicSalary] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [hourlyRate, setHourlyRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSalaryAssignment({
        employeeId,
        basicSalary: Number(basicSalary),
        currency: currency.trim() || 'TZS',
        hourlyRate: hourlyRate.trim()
          ? Number(hourlyRate)
          : undefined,
        effectiveFrom,
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
      title="Assign salary"
      description="Sets basic salary for payroll calculation."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
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
          Basic salary
          <input
            type="number"
            min={0}
            step="1"
            value={basicSalary}
            onChange={(e) => setBasicSalary(e.target.value)}
            className={inputCls}
            placeholder="850000"
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
            Currency
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputCls}
              placeholder="TZS"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Hourly rate{' '}
            <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              type="number"
              min={0}
              step="1"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Effective from
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
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
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting || employees.length === 0}
          >
            {submitting ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
