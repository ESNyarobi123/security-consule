'use client';

import {
  listEmployees,
  listLeaveRequests,
  type Employee,
  type LeaveRequest,
} from '@pssms/api-client';
import {
  DataTable,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import { CalendarClock, Clock, UserCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

export default function HrPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([listEmployees(), listLeaveRequests()]).then(
      ([emps, reqs]) => {
        setEmployees(emps);
        setLeave(reqs);
        setLoading(false);
      },
    );
  }, []);

  const employeeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, e.fullName);
    return map;
  }, [employees]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => norm(e.status) === 'active').length;
    const onLeave = employees.filter((e) =>
      norm(e.status).includes('leave'),
    ).length;
    const pending = leave.filter((l) => norm(l.status) === 'pending').length;
    return { total, active, onLeave, pending };
  }, [employees, leave]);

  return (
    <>
      <PageHeader
        title="Human resources"
        description="Employees and leave request queue"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total employees"
          value={stats.total}
          hint="Headcount on record"
          accent="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint="Currently employed"
          accent="emerald"
          icon={<UserCheck className="h-5 w-5" />}
        />
        <StatCard
          label="On leave"
          value={stats.onLeave}
          hint="Away from work"
          accent="amber"
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <StatCard
          label="Pending leave requests"
          value={stats.pending}
          hint="Awaiting approval"
          accent="rose"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Employees</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={employees}
          emptyMessage="No employees"
          columns={[
            { key: 'employeeNumber', label: 'Emp #' },
            { key: 'fullName', label: 'Name' },
            {
              key: 'department',
              label: 'Department',
              render: (r) => r.department ?? '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Leave requests</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={leave}
          emptyMessage="No leave requests"
          columns={[
            {
              key: 'employeeId',
              label: 'Employee',
              render: (r) => employeeName.get(r.employeeId) ?? r.employeeId,
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            { key: 'startDate', label: 'From' },
            { key: 'endDate', label: 'To' },
            {
              key: 'reason',
              label: 'Reason',
              render: (r) => r.reason ?? '—',
            },
          ]}
        />
      </div>
    </>
  );
}
