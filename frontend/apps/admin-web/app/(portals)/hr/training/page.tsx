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
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { GraduationCap, Plus, RefreshCw, Search } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TrainingRoster } from '../_components/HrRosters';
import { HrShell } from '../_components/HrShell';
import { PanelEmpty, formatDate } from '../_components/shared';

export default function HrTrainingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (employeeName.get(r.employeeId) ?? '').toLowerCase();
      return (
        name.includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.provider ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, employeeName]);

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

      <TrainingRoster
        rows={filtered}
        loading={loading}
        employeeName={employeeName}
        busyId={busyId}
        onComplete={(id) => void setStatus(id, 'COMPLETED')}
        onCancel={(id) => void setStatus(id, 'CANCELLED')}
        toolbar={
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
            <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee, course, provider…"
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
            />
          </label>
        }
        empty={
          <PanelEmpty
            icon={<GraduationCap className="h-4 w-4" />}
            title={rows.length === 0 ? 'No training records' : 'No matches'}
            description={
              rows.length === 0
                ? 'Log courses and certifications for employees.'
                : 'Try another search.'
            }
          />
        }
      />

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
