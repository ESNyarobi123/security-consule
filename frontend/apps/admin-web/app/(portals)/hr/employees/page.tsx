'use client';

import {
  createEmployee,
  listEmployees,
  listOrgUsers,
  updateEmployee,
  type Employee,
  type EmployeeStatus,
  type EmploymentType,
  type OrgUser,
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
import { Plus, RefreshCw, Users } from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { HrShell } from '../_components/HrShell';
import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  PanelEmpty,
  formatDate,
} from '../_components/shared';

export default function HrEmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<Employee | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmployees());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <HrShell
      title="Employees"
      description="Company employee registry (separate from customer staff access)."
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
            onClick={() => setCreateOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            New employee
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
              icon={<Users className="h-4 w-4" />}
              title="No employees"
              description="Create an employee record to start leave and salary workflows."
            />
          </div>
        ) : (
          <DataTable<Employee>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No employees"
            columns={[
              {
                key: 'employeeNumber',
                label: 'Emp #',
                render: (r) => (
                  <span className="font-mono text-sm">{r.employeeNumber}</span>
                ),
              },
              {
                key: 'fullName',
                label: 'Name',
                render: (r) => (
                  <button
                    type="button"
                    className="text-left font-medium text-[#0078d4] hover:underline"
                    onClick={() => setEditRow(r)}
                  >
                    {r.fullName}
                  </button>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: (r) => r.email ?? '—',
              },
              {
                key: 'phone',
                label: 'Phone',
                render: (r) => r.phone ?? '—',
              },
              {
                key: 'department',
                label: 'Department',
                render: (r) => r.department ?? '—',
              },
              {
                key: 'employmentType',
                label: 'Type',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {r.employmentType}
                  </span>
                ),
              },
              {
                key: 'userId',
                label: 'ESS',
                render: (r) =>
                  r.userId ? (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Linked
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">Unlinked</span>
                  ),
                },
                {
                  key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'hireDate',
                label: 'Hired',
                render: (r) => formatDate(r.hireDate),
              },
              {
                key: 'id',
                label: '',
                render: (r) => (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setEditRow(r)}
                  >
                    Edit
                  </button>
                ),
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateEmployeeModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {editRow ? (
        <EditEmployeeModal
          employee={editRow}
          onClose={() => setEditRow(null)}
          onSaved={async () => {
            setEditRow(null);
            await refresh();
          }}
        />
      ) : null}
    </HrShell>
  );
}

function CreateEmployeeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>('GUARD');
  const [hireDate, setHireDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createEmployee({
        employeeNumber: employeeNumber.trim(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        employmentType,
        hireDate: hireDate || undefined,
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
      title="New employee"
      description="Register a company employee. Guard field profiles stay under Operations."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
            Employee #
            <input
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              className={inputCls}
              placeholder="EMP-001"
              required
              minLength={2}
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
              placeholder="Jane Doe"
              required
              minLength={2}
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="jane@highlink.tz"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="+255 …"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Department
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={inputCls}
              placeholder="Operations"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Employment type
            <select
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as EmploymentType)
              }
              className={inputCls}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Hire date
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
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

function EditEmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(employee.email ?? '');
  const [phone, setPhone] = useState(employee.phone ?? '');
  const [department, setDepartment] = useState(employee.department ?? '');
  const [status, setStatus] = useState<EmployeeStatus>(
    (employee.status as EmployeeStatus) || 'ACTIVE',
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    (employee.employmentType as EmploymentType) || 'GUARD',
  );
  const [userId, setUserId] = useState(employee.userId ?? '');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listOrgUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateEmployee(employee.id, {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        status,
        employmentType,
        userId: userId.trim() ? userId.trim() : null,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={employee.fullName}
      description={`${employee.employeeNumber} · profile, status, ESS login link`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Department
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputCls}
          />
          <span className="mt-0.5 block text-[11px] font-normal text-[#605e5c]">
            Formal transfers use Movements → Transfer (approval). Exit uses
            Movements → Exit.
          </span>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Employment type
          <select
            value={employmentType}
            onChange={(e) =>
              setEmploymentType(e.target.value as EmploymentType)
            }
            className={inputCls}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
            className={inputCls}
          >
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          ESS login (user account)
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Not linked —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} · {u.email}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[11px] font-normal text-[#605e5c]">
            Required for My ESS portal (§35.5). One user ↔ one employee.
          </span>
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
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
