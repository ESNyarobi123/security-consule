'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

export const SUPERADMIN_TABS = [
  {
    href: '/superadmin',
    label: 'Overview',
    exact: true,
    permission: 'users.manage',
  },
  { href: '/superadmin/users', label: 'Users', permission: 'users.manage' },
  { href: '/superadmin/roles', label: 'Roles', permission: 'users.manage' },
  {
    href: '/superadmin/portals',
    label: 'Portals',
    permission: 'users.manage',
  },
  {
    href: '/superadmin/organization',
    label: 'Organization',
    permission: 'users.manage',
  },
  { href: '/superadmin/modules', label: 'Modules', permission: 'users.manage' },
  {
    href: '/superadmin/approval-levels',
    label: 'Approvals',
    permission: 'users.manage',
  },
  { href: '/superadmin/security', label: 'Security', permission: 'users.manage' },
  { href: '/superadmin/audit', label: 'Audit', permission: 'audit.read' },
  {
    href: '/superadmin/integrations',
    label: 'Integrations',
    permission: 'users.manage',
  },
  { href: '/superadmin/backups', label: 'Backups', permission: 'users.manage' },
  {
    href: '/superadmin/customers',
    label: 'Customers',
    permission: 'customers.manage',
  },
  {
    href: '/superadmin/contracts',
    label: 'Contracts',
    permission: 'contracts.manage',
  },
] as const;

export function SuperAdminShell({
  title,
  description,
  actions,
  children,
  variant = 'page',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: 'page' | 'overview';
}) {
  const pathname = usePathname();
  const sessionUser = useMemo(() => getSessionUser(), []);
  const tabs = SUPERADMIN_TABS.filter((tab) => can(sessionUser, tab.permission));
  const isOverview = variant === 'overview';

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview && title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#12263f] text-sky-200 ring-1 ring-sky-400/25">
              <AzureGlyph name="shield" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Super Admin · 35.1
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                {title}
              </h1>
              {description ? (
                <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label="Super Admin sections"
        className={`mb-5 flex gap-1 overflow-x-auto rounded-lg p-1 ${
          isOverview
            ? 'border border-slate-700/80 bg-[#0f2137]'
            : 'border border-[#e1dfdd] bg-[#faf9f8]'
        }`}
      >
        {tabs.map((tab) => {
          const exact = 'exact' in tab && tab.exact;
          const active = exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? isOverview
                    ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40'
                    : 'bg-white text-[#0078d4] shadow-sm ring-1 ring-[#e1dfdd]'
                  : isOverview
                    ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                    : 'text-[#605e5c] hover:bg-white/70 hover:text-[#323130]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
