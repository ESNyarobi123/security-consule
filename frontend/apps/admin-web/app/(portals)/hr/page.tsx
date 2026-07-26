'use client';

import {
  listEmployees,
  listLeaveRequests,
  listLeaveTypes,
  listSalaryAssignments,
  type Employee,
  type LeaveRequest,
  type LeaveType,
  type SalaryAssignment,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  StatCard,
  StatusBadge,
  btnSecondary,
} from '@pssms/ui';
import {
  Banknote,
  CalendarClock,
  Clock,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HrShell } from './_components/HrShell';
import {
  PanelEmpty,
  QuickLink,
  SectionLabel,
  formatDate,
  formatMoney,
} from './_components/shared';

const PREVIEW = 12;

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

export default function HrOverviewPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [salary, setSalary] = useState<SalaryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, reqs, leaveTypes, assignments] = await Promise.all([
        listEmployees(),
        listLeaveRequests(),
        listLeaveTypes(),
        listSalaryAssignments(),
      ]);
      setEmployees(emps);
      setLeave(reqs);
      setTypes(leaveTypes);
      setSalary(assignments);
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

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => norm(e.status) === 'active').length;
    const onLeave = employees.filter((e) =>
      norm(e.status).includes('leave'),
    ).length;
    const pending = leave.filter((l) => norm(l.status) === 'pending').length;
    const activeSalary = salary.filter((s) => s.isActive).length;
    return { total, active, onLeave, pending, activeSalary };
  }, [employees, leave, salary]);

  const empPreview = employees.slice(0, PREVIEW);
  const leavePreview = leave.slice(0, PREVIEW);
  const salaryPreview = salary.slice(0, PREVIEW);

  return (
    <HrShell
      title="HR overview"
      description="Phase A–C — employees, leave, salary, training, discipline, and transfer/exit. ESS and employee documents come later. Use tabs for a focused page."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '…' : 'Refresh'}
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Employees"
          value={loading ? '…' : stats.total}
          hint="Headcount on record"
          accent="blue"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active"
          value={loading ? '…' : stats.active}
          hint={`${stats.onLeave} on leave`}
          accent="emerald"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Pending leave"
          value={loading ? '…' : stats.pending}
          hint="Awaiting approval"
          accent={stats.pending > 0 ? 'amber' : 'slate'}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Salary assignments"
          value={loading ? '…' : stats.activeSalary}
          hint={`${salary.length} total`}
          accent="blue"
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      <section className="mt-6">
        <SectionLabel
          title="Employees"
          href="/hr/employees"
          count={employees.length}
        />
        <GlassCard className="!p-0 overflow-hidden">
          {empPreview.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Users className="h-4 w-4" />}
                title="No employees"
                description="Register company employees on the Employees tab."
              />
            </div>
          ) : (
            <DataTable<Employee>
              loading={loading}
              keyField="id"
              rows={empPreview}
              emptyMessage="No employees"
              columns={[
                {
                  key: 'employeeNumber',
                  label: 'Emp #',
                  render: (r) => (
                    <span className="font-mono text-sm">{r.employeeNumber}</span>
                  ),
                },
                { key: 'fullName', label: 'Name' },
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
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
            />
          )}
        </GlassCard>
        {employees.length > PREVIEW ? (
          <p className="mt-2 text-[11px] text-[#605e5c]">
            Showing {PREVIEW} of {employees.length}.
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <SectionLabel
          title="Leave requests"
          href="/hr/leave"
          count={leave.length}
        />
        <GlassCard className="!p-0 overflow-hidden">
          {leavePreview.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<CalendarClock className="h-4 w-4" />}
                title="No leave requests"
                description="Apply for leave and manage types on the Leave tab."
              />
            </div>
          ) : (
            <DataTable<LeaveRequest>
              loading={loading}
              keyField="id"
              rows={leavePreview}
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
                  render: (r) =>
                    leaveTypeName.get(r.leaveTypeId) ?? '—',
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
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      <section className="mt-6">
        <SectionLabel
          title="Salary assignments"
          href="/hr/salary"
          count={salary.length}
        />
        <GlassCard className="!p-0 overflow-hidden">
          {salaryPreview.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Banknote className="h-4 w-4" />}
                title="No salary assignments"
                description="Assign basic salary on the Salary tab before payroll runs."
              />
            </div>
          ) : (
            <DataTable<SalaryAssignment>
              loading={loading}
              keyField="id"
              rows={salaryPreview}
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
                  render: (r) => formatMoney(r.basicSalary, r.currency),
                },
                {
                  key: 'effectiveFrom',
                  label: 'From',
                  render: (r) => formatDate(r.effectiveFrom),
                },
                {
                  key: 'isActive',
                  label: 'Active',
                  render: (r) => (
                    <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Workforce lifecycle
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/hr/training"
            label="Training"
            hint="Courses, complete or cancel"
            glyph="calendar"
          />
          <QuickLink
            href="/hr/discipline"
            label="Discipline"
            hint="Open cases and close with outcome"
            glyph="shield"
          />
          <QuickLink
            href="/hr/movements"
            label="Movements"
            hint="Transfer / exit approvals"
            glyph="building"
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Related portals
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/operations/guards"
            label="Guard profiles"
            hint="Deployment-eligible field staff"
            glyph="shield"
          />
          <QuickLink
            href="/payroll"
            label="Payroll"
            hint="Cycles, payslips, bank files"
            glyph="wallet"
          />
          <QuickLink
            href="/finance"
            label="Finance"
            hint="Invoices & petty cash (loans UI later)"
            glyph="coins"
          />
          <QuickLink
            href="/approvals"
            label="Approvals"
            hint="Leave and other workflows"
            glyph="calendar"
          />
        </div>
        <p className="mt-3 text-[11px] text-[#605e5c]">
          Employee loans API exists but there is no dedicated loans page in
          admin-web yet. Recruitment applications live on the public recruitment
          portal (separate app), not under /hr.
        </p>
      </section>
    </HrShell>
  );
}
