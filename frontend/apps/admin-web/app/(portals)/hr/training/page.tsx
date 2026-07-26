'use client';

import {
  createTrainingRecord,
  listEmployees,
  listTrainingRecords,
  updateTrainingRecord,
  type Employee,
  type TrainingRecord,
  type TrainingStatus,
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
import { GraduationCap, Plus, RefreshCw } from 'lucide-react';
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

export default function HrTrainingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, records] = await Promise.all([
        listEmployees(),
        listTrainingRecords(),
      ]);
      setEmployees(emps);
      setRows(records);
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

  const setStatus = async (id: string, status: TrainingStatus) => {
    setBusyId(id);
    setError(null);
    try {
      await updateTrainingRecord(id, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HrShell
      title="Training"
      description="Record planned training and mark completed or cancelled."
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
            Add training
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
              icon={<GraduationCap className="h-4 w-4" />}
              title="No training records"
              description="Log courses and certifications for employees."
            />
          </div>
        ) : (
          <DataTable<TrainingRecord>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No training records"
            columns={[
              {
                key: 'employeeId',
                label: 'Employee',
                render: (r) =>
                  employeeName.get(r.employeeId) ?? r.employeeId.slice(0, 8),
              },
              {
                key: 'title',
                label: 'Title',
                render: (r) => (
                  <span className="font-medium text-[#1b1a19]">{r.title}</span>
                ),
              },
              {
                key: 'provider',
                label: 'Provider',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {r.provider ?? '—'}
                  </span>
                ),
              },
              {
                key: 'startDate',
                label: 'Start',
                render: (r) => formatDate(r.startDate),
              },
              {
                key: 'endDate',
                label: 'End',
                render: (r) => formatDate(r.endDate),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'notes',
                label: 'Notes',
                render: (r) =>
                  r.notes ? (
                    <span
                      className="max-w-[160px] truncate text-xs text-[#605e5c]"
                      title={r.notes}
                    >
                      {r.notes}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  ),
              },
              {
                key: 'id',
                label: '',
                render: (r) => {
                  const planned = norm(r.status) === 'planned';
                  if (!planned) {
                    return (
                      <span className="text-[11px] text-[#a19f9d]">—</span>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busyId === r.id}
                        onClick={() => void setStatus(r.id, 'COMPLETED')}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={busyId === r.id}
                        onClick={() => void setStatus(r.id, 'CANCELLED')}
                      >
                        Cancel
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
        <CreateTrainingModal
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

function CreateTrainingModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTrainingRecord({
        employeeId,
        title: title.trim(),
        provider: provider.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: notes.trim() || undefined,
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
      title="Add training"
      description="Creates a planned training record for the employee."
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
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="First aid certification"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Provider{' '}
            <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={inputCls}
              placeholder="Red Cross"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Start date{' '}
            <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            End date{' '}
            <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Notes <span className="font-normal text-[#605e5c]">(optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Venue, certificate ref, etc."
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
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
