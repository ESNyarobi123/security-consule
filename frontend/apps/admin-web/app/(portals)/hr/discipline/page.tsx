'use client';

import {
  createDisciplineCase,
  listDisciplineCases,
  listEmployees,
  updateDisciplineCase,
  type DisciplineCase,
  type DisciplineSeverity,
  type Employee,
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
import { Plus, RefreshCw, Scale } from 'lucide-react';
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

const SEVERITIES: DisciplineSeverity[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export default function HrDisciplinePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<DisciplineCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<DisciplineCase | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, cases] = await Promise.all([
        listEmployees(),
        listDisciplineCases(),
      ]);
      setEmployees(emps);
      setRows(cases);
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
      title="Discipline"
      description="Open cases for misconduct; close with a recorded outcome."
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
            Open case
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
              icon={<Scale className="h-4 w-4" />}
              title="No discipline cases"
              description="Record incidents and close them with an outcome."
            />
          </div>
        ) : (
          <DataTable<DisciplineCase>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No discipline cases"
            columns={[
              {
                key: 'employeeId',
                label: 'Employee',
                render: (r) =>
                  employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
              },
              {
                key: 'incidentDate',
                label: 'Incident',
                render: (r) => formatDate(r.incidentDate),
              },
              {
                key: 'category',
                label: 'Category',
                render: (r) => (
                  <span className="text-xs font-medium text-[#1b1a19]">
                    {r.category}
                  </span>
                ),
              },
              {
                key: 'severity',
                label: 'Severity',
                render: (r) => <StatusBadge status={r.severity} />,
              },
              {
                key: 'description',
                label: 'Description',
                render: (r) => (
                  <span
                    className="max-w-[180px] truncate text-xs text-[#605e5c]"
                    title={r.description}
                  >
                    {r.description}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'outcome',
                label: 'Outcome',
                render: (r) =>
                  r.outcome ? (
                    <span
                      className="max-w-[140px] truncate text-xs text-[#605e5c]"
                      title={r.outcome}
                    >
                      {r.outcome}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  if (norm(r.status) !== 'open') {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">—</span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => setCloseTarget(r)}
                    >
                      Close
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </GlassCard>

      {open ? (
        <CreateDisciplineModal
          employees={employees}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {closeTarget ? (
        <CloseDisciplineModal
          caseItem={closeTarget}
          employeeName={
            employeeName.get(closeTarget.employeeId) ?? closeTarget.employeeId
          }
          onClose={() => setCloseTarget(null)}
          onClosed={async () => {
            setCloseTarget(null);
            await refresh();
          }}
        />
      ) : null}
    </HrShell>
  );
}

function CreateDisciplineModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [incidentDate, setIncidentDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState<DisciplineSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createDisciplineCase({
        employeeId,
        incidentDate,
        category: category.trim(),
        severity,
        description: description.trim(),
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
      title="Open discipline case"
      description="Records an incident for HR follow-up."
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
            Incident date
            <input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
              placeholder="Lateness / misconduct / …"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Severity
            <select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as DisciplineSeverity)
              }
              className={inputCls}
              required
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} min-h-[88px]`}
            placeholder="What happened (min 3 characters)"
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
            {submitting ? 'Saving…' : 'Open case'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CloseDisciplineModal({
  caseItem,
  employeeName,
  onClose,
  onClosed,
}: {
  caseItem: DisciplineCase;
  employeeName: string;
  onClose: () => void;
  onClosed: () => Promise<void>;
}) {
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateDisciplineCase(caseItem.id, {
        status: 'CLOSED',
        outcome: outcome.trim(),
      });
      await onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Close discipline case"
      description={`${employeeName} · ${caseItem.category} · ${formatDate(caseItem.incidentDate)}`}
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Outcome
          <textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Warning issued, suspension days, etc. (min 3 chars)"
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
            {submitting ? 'Closing…' : 'Close case'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
