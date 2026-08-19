'use client';

import {
  getOrganization,
  listApprovalInstances,
  listApprovalWorkflows,
  listBranches,
  listContracts,
  listCustomers,
  listDepartments,
  listEmployees,
  type ApprovalInstance,
  type ApprovalWorkflow,
  type Branch,
  type Department,
  type OrganizationProfile,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, MetricStatCard } from '@pssms/ui';
import {
  Building2,
  FileStack,
  FolderOpen,
  ListChecks,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatApiError } from './_components/shared';

const TOPICS: {
  title: string;
  href: string;
  description: string;
  permission: string;
}[] = [
  {
    title: 'Company records',
    href: '/administration/organization',
    description: 'Organization profile, branches, and departments',
    permission: 'enterprise.manage',
  },
  {
    title: 'Customer files',
    href: '/administration/customer-files',
    description: 'MinIO attachments on customer records',
    permission: 'customers.manage',
  },
  {
    title: 'Staff files',
    href: '/administration/staff-files',
    description: 'Employee register + MinIO staff file (hr.manage)',
    permission: 'enterprise.manage',
  },
  {
    title: 'Contract files',
    href: '/administration/contract-files',
    description: 'Signed agreements and contract attachments',
    permission: 'contracts.manage',
  },
  {
    title: 'Internal requests',
    href: '/administration/requests',
    description: 'Pending approval instances (leave, contracts, IAM, …)',
    permission: 'enterprise.manage',
  },
  {
    title: 'Document approvals',
    href: '/administration/approvals',
    description: 'Workflow catalog and queue — creator ≠ approver',
    permission: 'approvals.act',
  },
  {
    title: 'Office operations',
    href: '/administration/office',
    description: 'Sites, access points, petty cash, ESS requests',
    permission: 'enterprise.manage',
  },
];

export default function AdministrationOverviewPage() {
  const session = useMemo(() => getSessionUser(), []);
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customers, setCustomers] = useState(0);
  const [contracts, setContracts] = useState(0);
  const [staff, setStaff] = useState(0);
  const [pending, setPending] = useState(0);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      getOrganization().catch(() => null),
      listBranches().catch(() => [] as Branch[]),
      listDepartments().catch(() => [] as Department[]),
      can(session, 'customers.manage')
        ? listCustomers().catch(() => [])
        : Promise.resolve([]),
      can(session, 'contracts.manage')
        ? listContracts().catch(() => [])
        : Promise.resolve([]),
      can(session, 'hr.manage')
        ? listEmployees().catch(() => [])
        : Promise.resolve([]),
      can(session, 'approvals.act')
        ? listApprovalInstances().catch(() => [] as ApprovalInstance[])
        : Promise.resolve([] as ApprovalInstance[]),
      can(session, 'approvals.act')
        ? listApprovalWorkflows().catch(() => [] as ApprovalWorkflow[])
        : Promise.resolve([] as ApprovalWorkflow[]),
    ])
      .then(([o, b, d, c, k, e, inst, w]) => {
        setOrg(o);
        setBranches(b);
        setDepartments(d);
        setCustomers(c.length);
        setContracts(k.length);
        setStaff(e.length);
        setPending(inst.filter((i) => i.status === 'PENDING').length);
        setWorkflows(w);
        setLoading(false);
      })
      .catch((err) => {
        setError(formatApiError(err));
        setLoading(false);
      });
  }, [session]);

  const visible = TOPICS.filter((t) => can(session, t.permission));
  const activeBranches = branches.filter((b) => b.isActive).length;
  const activeDepts = departments.filter((d) => d.isActive).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0078d4]">
          Portal 35.3 · Administration
        </p>
        <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
          Office records & operations
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[#605e5c]">
          For General Manager, Branch Managers, Department Heads, and authorized
          office staff — company records, branches, departments, customer and
          contract files, internal requests, and document approvals. Super Admin
          (35.1) stays IAM/platform; Branch Ops (35.23) stays field duty.
        </p>
        {org ? (
          <p className="mt-2 text-sm text-[#323130]">
            {org.name} · {org.code}
            {org.tin ? ` · TIN ${org.tin}` : ''}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricStatCard
          label="Active branches"
          value={loading ? '…' : String(activeBranches)}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricStatCard
          label="Active departments"
          value={loading ? '…' : String(activeDepts)}
          icon={<Building2 className="h-4 w-4" />}
        />
        {can(session, 'hr.manage') ? (
          <MetricStatCard
            label="Staff records"
            value={loading ? '…' : String(staff)}
            icon={<Users className="h-4 w-4" />}
          />
        ) : can(session, 'customers.manage') ? (
          <MetricStatCard
            label="Customer files"
            value={loading ? '…' : String(customers)}
            icon={<FolderOpen className="h-4 w-4" />}
          />
        ) : (
          <MetricStatCard
            label="Approval workflows"
            value={loading ? '…' : String(workflows.length)}
            icon={<ListChecks className="h-4 w-4" />}
          />
        )}
        {can(session, 'approvals.act') ? (
          <MetricStatCard
            label="Pending requests"
            value={loading ? '…' : String(pending)}
            icon={<FileStack className="h-4 w-4" />}
          />
        ) : can(session, 'contracts.manage') ? (
          <MetricStatCard
            label="Contracts"
            value={loading ? '…' : String(contracts)}
            icon={<FileStack className="h-4 w-4" />}
          />
        ) : (
          <MetricStatCard
            label="Departments"
            value={loading ? '…' : String(departments.length)}
            icon={<ListChecks className="h-4 w-4" />}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <Link key={t.href} href={t.href}>
            <GlassCard
              glow="none"
              className="h-full p-4 transition hover:border-[#0078d4]/40"
            >
              <p className="text-sm font-semibold text-[#1b1a19]">{t.title}</p>
              <p className="mt-1 text-sm text-[#605e5c]">{t.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-[#8a8886]">
        Live counts from core-api · customer/staff/contract files need the matching
        domain permission · employee MinIO vault and ADMINISTRATION_OFFICER /
        RECORDS_OFFICER roles deferred
      </p>
    </div>
  );
}
