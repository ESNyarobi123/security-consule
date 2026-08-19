'use client';

import {
  getOrganization,
  listApprovalWorkflows,
  listAuditLogs,
  listBranches,
  listDepartments,
  listPermissions,
  listRoles,
  listUsers,
  type ApprovalWorkflow,
  type AuditLog,
  type Branch,
  type Department,
  type OrganizationProfile,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, MetricStatCard } from '@pssms/ui';
import {
  Building2,
  KeyRound,
  Layers,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatApiError } from './_components/shared';

const CONTROLS: {
  title: string;
  href: string;
  description: string;
  permission: string;
}[] = [
  {
    title: 'Users',
    href: '/superadmin/users',
    description: 'Accounts, roles, suspend, MFA reset, site ACL',
    permission: 'users.manage',
  },
  {
    title: 'Roles & permissions',
    href: '/superadmin/roles',
    description: 'Custom roles and permission sets (system roles locked)',
    permission: 'users.manage',
  },
  {
    title: 'Portals & accounts',
    href: '/superadmin/portals',
    description: '§35 applications and §36 account types vs live IAM',
    permission: 'users.manage',
  },
  {
    title: 'Branches & departments',
    href: '/superadmin/organization',
    description: 'Company profile and enterprise master data',
    permission: 'users.manage',
  },
  {
    title: 'Modules',
    href: '/superadmin/modules',
    description: 'Live RBAC module catalog from permission registry',
    permission: 'users.manage',
  },
  {
    title: 'Approval levels',
    href: '/superadmin/approval-levels',
    description: 'Workflow steps and required roles (creator ≠ approver)',
    permission: 'users.manage',
  },
  {
    title: 'Security settings',
    href: '/superadmin/security',
    description: 'Organization password policy (GM / Super Admin write)',
    permission: 'users.manage',
  },
  {
    title: 'System logs',
    href: '/superadmin/audit',
    description: 'Append-only audit trail for this organization',
    permission: 'audit.read',
  },
  {
    title: 'Integrations',
    href: '/superadmin/integrations',
    description: 'Adapters, webhooks, and developer health',
    permission: 'users.manage',
  },
  {
    title: 'Backups',
    href: '/superadmin/backups',
    description: 'Infrastructure volumes — orchestrated restore deferred',
    permission: 'users.manage',
  },
];

export default function SuperadminPage() {
  const session = useMemo(() => getSessionUser(), []);
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [users, setUsers] = useState(0);
  const [roles, setRoles] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [modules, setModules] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      getOrganization().catch(() => null),
      listUsers().catch(() => []),
      listRoles().catch(() => []),
      listBranches().catch(() => [] as Branch[]),
      listDepartments().catch(() => [] as Department[]),
      listApprovalWorkflows().catch(() => [] as ApprovalWorkflow[]),
      listAuditLogs(40).catch(() => [] as AuditLog[]),
      listPermissions().catch(() => []),
    ]).then(([o, u, r, b, d, w, a, p]) => {
      setOrg(o);
      setUsers(u.length);
      setRoles(r.length);
      setBranches(b);
      setDepartments(d);
      setWorkflows(w);
      setAudit(a);
      setModules(new Set(p.map((x) => x.module)).size);
      setLoading(false);
    }).catch((err) => {
      setError(formatApiError(err));
      setLoading(false);
    });
  }, []);

  const visibleControls = CONTROLS.filter((c) => can(session, c.permission));
  const activeBranches = branches.filter((b) => b.isActive).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0078d4]">
            Portal 35.1 · Super Admin
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Platform administration
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[#605e5c]">
            Users, roles, permissions, branches, departments, modules, approval
            levels, security settings, system logs, integrations, backups, and
            audit controls — for Super Admin, ICT, CISO, and authorized senior
            ICT staff.
            {org ? ` Organization: ${org.name} (${org.code}).` : ''}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7e0f4] bg-[#eff6fc] px-3 py-1 text-[11px] font-medium text-[#0067b8]">
          <span
            className={`h-1.5 w-1.5 rounded-full bg-[#0078d4] ${loading ? 'animate-pulse' : ''}`}
          />
          {loading ? 'Syncing…' : 'Live data'}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/superadmin/users" className="block h-full">
          <MetricStatCard
            label="Users"
            value={users}
            accent="sky"
            icon={<Users className="h-5 w-5" />}
          />
        </Link>
        <Link href="/superadmin/roles" className="block h-full">
          <MetricStatCard
            label="Roles"
            value={roles}
            accent="violet"
            icon={<KeyRound className="h-5 w-5" />}
          />
        </Link>
        <Link href="/superadmin/organization" className="block h-full">
          <MetricStatCard
            label="Active branches"
            value={activeBranches}
            accent="emerald"
            icon={<Building2 className="h-5 w-5" />}
          />
        </Link>
        <Link href="/superadmin/modules" className="block h-full">
          <MetricStatCard
            label="RBAC modules"
            value={modules}
            accent="amber"
            icon={<Layers className="h-5 w-5" />}
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard glow="none" className="lg:col-span-2">
          <h2 className="text-[15px] font-semibold text-[#1b1a19]">
            Platform controls
          </h2>
          <p className="mt-1 text-xs text-[#605e5c]">
            Design §35.1 — one portal, live APIs, least privilege per tab.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleControls.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-[#e1dfdd] bg-white p-3 transition hover:border-[#0078d4] hover:bg-[#f3f9fd]"
              >
                <p className="text-sm font-semibold text-[#1b1a19]">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-[#605e5c]">{item.description}</p>
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard glow="none">
          <h2 className="text-[15px] font-semibold text-[#1b1a19]">
            Approval workflows
          </h2>
          <p className="mt-1 text-xs text-[#605e5c]">
            {workflows.length} definitions · {departments.length} departments
          </p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
            {workflows.length === 0 ? (
              <li className="text-[#605e5c]">No workflows in scope.</li>
            ) : (
              workflows.slice(0, 8).map((wf) => (
                <li key={wf.id} className="flex justify-between gap-2">
                  <span className="font-medium text-[#323130]">{wf.name}</span>
                  <span className="tabular-nums text-xs text-[#605e5c]">
                    {wf.steps.length} steps
                  </span>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/superadmin/approval-levels"
            className="mt-3 inline-block text-xs font-medium text-[#0078d4]"
          >
            View approval levels
          </Link>
        </GlassCard>
      </div>

      <GlassCard glow="none">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#1b1a19]">
            Recent audit events
          </h2>
          <Link
            href="/superadmin/audit"
            className="text-xs font-medium text-[#0078d4]"
          >
            Open logs
          </Link>
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-[#605e5c]">No audit rows returned.</p>
        ) : (
          <ul className="divide-y divide-[#edebe9] text-sm">
            {audit.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="font-mono text-xs text-[#323130]">
                  {row.action}
                </span>
                <span className="text-xs text-[#605e5c]">
                  {row.resourceType}
                  {row.createdAt
                    ? ` · ${new Date(row.createdAt).toLocaleString()}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#605e5c]">
          <Shield className="h-3.5 w-3.5" />
          Creator ≠ approver remains on domain workflows. Backup orchestration
          and per-org module switches are not invented here.
        </p>
      </GlassCard>
    </div>
  );
}
