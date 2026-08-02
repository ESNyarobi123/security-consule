'use client';

import {
  listDisciplineCases,
  listEmployeeMovements,
  listEmployees,
  listLeaveRequests,
  listLeaveTypes,
  listSalaryAssignments,
  listTrainingRecords,
  type DisciplineCase,
  type Employee,
  type EmployeeMovement,
  type LeaveRequest,
  type LeaveType,
  type SalaryAssignment,
  type TrainingRecord,
} from '@pssms/api-client';
import { StatCard, btnSecondary } from '@pssms/ui';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Clock,
  GraduationCap,
  RefreshCw,
  Scale,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeRoster } from './_components/EmployeeRoster';
import {
  DisciplineRoster,
  LeaveRequestRoster,
  MovementRoster,
  SalaryRoster,
  TrainingRoster,
} from './_components/HrRosters';
import { HrShell } from './_components/HrShell';
import { HrSectionHeader } from './_components/hr-list';
import { PanelEmpty, QuickLink } from './_components/shared';

const PREVIEW = 8;

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

export default function HrOverviewPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [salary, setSalary] = useState<SalaryAssignment[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineCase[]>([]);
  const [movements, setMovements] = useState<EmployeeMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, reqs, leaveTypes, assignments, train, cases, moves] =
        await Promise.all([
          listEmployees(),
          listLeaveRequests(),
          listLeaveTypes(),
          listSalaryAssignments(),
          listTrainingRecords().catch(() => [] as TrainingRecord[]),
          listDisciplineCases().catch(() => [] as DisciplineCase[]),
          listEmployeeMovements().catch(() => [] as EmployeeMovement[]),
        ]);
      setEmployees(emps);
      setLeave(reqs);
      setTypes(leaveTypes);
      setSalary(assignments);
      setTraining(train);
      setDiscipline(cases);
      setMovements(moves);
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

  return (
    <HrShell
      title="HR overview"
      description="Phase A–C — employees, leave, salary, training, discipline, and transfer/exit. Use tabs for focused work."
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
        <HrSectionHeader
          title="Employees"
          count={employees.length}
          subtitle="Company workforce registry — identity, role, department & status"
          href="/hr/employees"
          actionLabel="Manage roster"
        />
        <EmployeeRoster
          rows={employees.slice(0, PREVIEW)}
          loading={loading}
          compact
          empty={
            <PanelEmpty
              icon={<Users className="h-4 w-4" />}
              title="No employees"
              description="Register company employees on the Employees tab."
            />
          }
        />
        {employees.length > PREVIEW ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#605e5c]">
              Showing {PREVIEW} of {employees.length}
            </p>
            <Link
              href="/hr/employees"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0067b8] hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <HrSectionHeader
          title="Leave requests"
          count={leave.length}
          subtitle="Pending and recent leave applications"
          href="/hr/leave"
          actionLabel="Manage leave"
        />
        <LeaveRequestRoster
          rows={leave.slice(0, PREVIEW)}
          loading={loading}
          employeeName={employeeName}
          leaveTypeName={leaveTypeName}
          compact
          empty={
            <PanelEmpty
              icon={<CalendarClock className="h-4 w-4" />}
              title="No leave requests"
              description="Apply for leave and manage types on the Leave tab."
            />
          }
        />
      </section>

      <section className="mt-6">
        <HrSectionHeader
          title="Salary assignments"
          count={salary.length}
          subtitle="Basic pay used by payroll cycles"
          href="/hr/salary"
          actionLabel="Manage salary"
        />
        <SalaryRoster
          rows={salary.slice(0, PREVIEW)}
          loading={loading}
          employeeName={employeeName}
          compact
          empty={
            <PanelEmpty
              icon={<Banknote className="h-4 w-4" />}
              title="No salary assignments"
              description="Assign basic salary on the Salary tab before payroll runs."
            />
          }
        />
      </section>

      <section className="mt-6">
        <HrSectionHeader
          title="Training"
          count={training.length}
          subtitle="Planned and completed courses"
          href="/hr/training"
          actionLabel="Manage training"
        />
        <TrainingRoster
          rows={training.slice(0, PREVIEW)}
          loading={loading}
          employeeName={employeeName}
          compact
          empty={
            <PanelEmpty
              icon={<GraduationCap className="h-4 w-4" />}
              title="No training records"
              description="Log courses on the Training tab."
            />
          }
        />
      </section>

      <section className="mt-6">
        <HrSectionHeader
          title="Discipline"
          count={discipline.length}
          subtitle="Open and closed misconduct cases"
          href="/hr/discipline"
          actionLabel="Manage cases"
        />
        <DisciplineRoster
          rows={discipline.slice(0, PREVIEW)}
          loading={loading}
          employeeName={employeeName}
          compact
          empty={
            <PanelEmpty
              icon={<Scale className="h-4 w-4" />}
              title="No discipline cases"
              description="Open cases on the Discipline tab."
            />
          }
        />
      </section>

      <section className="mt-6">
        <HrSectionHeader
          title="Movements"
          count={movements.length}
          subtitle="Transfer and exit approvals"
          href="/hr/movements"
          actionLabel="Manage movements"
        />
        <MovementRoster
          rows={movements.slice(0, PREVIEW)}
          loading={loading}
          employeeName={employeeName}
          compact
          empty={
            <PanelEmpty
              icon={<Users className="h-4 w-4" />}
              title="No movements"
              description="Request transfer or exit on the Movements tab."
            />
          }
        />
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
            hint="Invoices & petty cash"
            glyph="coins"
          />
          <QuickLink
            href="/approvals"
            label="Approvals"
            hint="Leave and other workflows"
            glyph="calendar"
          />
          <QuickLink
            href="/ess"
            label="Employee self-service"
            hint="Linked staff ESS portal"
            glyph="users"
          />
        </div>
      </section>
    </HrShell>
  );
}
