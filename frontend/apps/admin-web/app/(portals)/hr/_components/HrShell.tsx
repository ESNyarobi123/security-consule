'use client';

import { getSessionUser } from '@pssms/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AzureGlyph } from '@pssms/ui';

export const HR_TABS = [
  { href: '/hr', label: 'Overview', exact: true, permission: 'hr.manage' },
  {
    href: '/hr/employees',
    label: 'Employees',
    permission: 'hr.manage',
    /** Branch Managers (hr.branch) see their own branch's roster read-only. */
    alsoPermits: ['hr.branch'],
  },
  {
    href: '/hr/onboarding',
    label: 'Onboarding',
    permission: 'hr.manage',
  },
  { href: '/hr/leave', label: 'Leave', permission: 'hr.manage' },
  { href: '/hr/salary', label: 'Salary', permission: 'hr.manage' },
  { href: '/hr/training', label: 'Training', permission: 'hr.manage' },
  { href: '/hr/discipline', label: 'Discipline', permission: 'hr.manage' },
  { href: '/hr/movements', label: 'Movements', permission: 'hr.manage' },
  {
    href: '/hr/applications',
    label: 'Applications',
    permission: 'recruitment.manage',
  },
  {
    href: '/hr/b2b-requests',
    label: 'B2B requests',
    permission: 'recruitment.manage',
  },
] as const;

export function HrShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = getSessionUser();
  const perms = session?.permissions ?? [];
  const isSuper = session?.roles?.includes('SUPER_ADMIN');
  const orgWideHr = isSuper || perms.includes('hr.manage');
  const branchHr = perms.includes('hr.branch');
  const tabs = HR_TABS.filter((tab) => {
    const own = isSuper || perms.includes(tab.permission);
    const extra = ('alsoPermits' in tab ? tab.alsoPermits ?? [] : []).some(
      (code) => perms.includes(code),
    );
    return own || extra;
  });
  // Branch HR (hr.branch) only owns the employees roster. Any other HR surface
  // (leave, salary, movements…) stays org-wide, so show the honest scope card
  // instead of a page full of 403s.
  const branchOnlyBlocked =
    !orgWideHr &&
    !(
      pathname === '/hr/employees' ||
      pathname.startsWith('/hr/employees/') ||
      pathname.startsWith('/hr/applications') ||
      pathname.startsWith('/hr/b2b-requests')
    );

  if (branchOnlyBlocked) {
    return (
      <div>
        <div className="mb-4 border-b border-[#e1dfdd] pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
            Portal 35.4 · HR & Employee Management
          </p>
          <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
            {title}
          </h1>
        </div>
        <div className="rounded-lg border border-[#e1dfdd] bg-white p-4">
          <p className="text-sm text-[#323130]">
            Your role covers <strong>branch staff</strong>, not company-wide HR.
            Leave, salary, movements, training and discipline are handled by HR
            at head office.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/hr/employees"
              className="inline-flex items-center gap-1 rounded-md bg-[#0078d4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#106ebe]"
            >
              Branch staff register
            </Link>
            <Link
              href="/branch/staff"
              className="inline-flex items-center gap-1 rounded-md border border-[#e1dfdd] bg-white px-3 py-1.5 text-xs font-semibold text-[#323130] hover:bg-[#f3f9fd]"
            >
              Manage branch staff
            </Link>
          </div>
          {branchHr ? (
            <p className="mt-3 text-[11px] text-[#605e5c]">
              You can also open staff files under Administration → Staff files —
              scoped to your branch.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff4ce] text-[#8a6914]">
            <AzureGlyph name="users" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
              Portal 35.4 · HR & Employee Management
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

      <nav
        aria-label="HR sections"
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
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
                  ? 'bg-white text-[#0078d4] shadow-sm ring-1 ring-[#e1dfdd]'
                  : 'text-[#605e5c] hover:bg-white/70 hover:text-[#323130]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <Link
          href="/operations/guards"
          className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
        >
          Guards →
        </Link>
      </nav>

      {children}
    </div>
  );
}
