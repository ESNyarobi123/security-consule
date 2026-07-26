'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

export const BRANCH_TABS = [
  {
    href: '/branch',
    label: 'Overview',
    exact: true,
    permission: 'operations.manage',
  },
  {
    href: '/branch/sites',
    label: 'Sites',
    permission: 'operations.manage',
  },
  {
    href: '/branch/deployments',
    label: 'Deployments',
    permission: 'operations.manage',
  },
  {
    href: '/branch/shifts',
    label: 'Shifts',
    permission: 'operations.manage',
  },
  {
    href: '/branch/attendance',
    label: 'Attendance',
    permission: 'operations.manage',
  },
  {
    href: '/branch/alerts',
    label: 'Field alerts',
    permission: 'operations.manage',
  },
  {
    href: '/branch/eob',
    label: 'EOB',
    permission: 'operations.manage',
  },
  {
    href: '/branch/patrols',
    label: 'Patrols',
    permission: 'operations.manage',
  },
  {
    href: '/branch/incidents',
    label: 'Incidents',
    permission: 'incidents.manage',
  },
] as const;

export function BranchShell({
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
  /** `overview` skips compact title — page owns the navy/teal hero. */
  variant?: 'page' | 'overview';
}) {
  const pathname = usePathname();
  const sessionUser = useMemo(() => getSessionUser(), []);
  const tabs = BRANCH_TABS.filter((tab) =>
    can(sessionUser, tab.permission),
  );
  const isOverview = variant === 'overview';

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#12263f] text-sky-200 ring-1 ring-sky-400/25">
              <AzureGlyph name="branch" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Branch Operations · 35.23
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
        aria-label="Branch Ops sections"
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
                    ? 'bg-sky-400 text-[#072033] shadow font-semibold'
                    : 'bg-[#12263f] text-sky-100 shadow-sm ring-1 ring-sky-400/30'
                  : isOverview
                    ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'text-[#605e5c] hover:bg-white/70 hover:text-[#323130]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        {can(sessionUser, 'operations.manage') ? (
          <Link
            href="/operations"
            className={`ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
              isOverview
                ? 'text-sky-300 hover:bg-white/10 hover:text-sky-200'
                : 'text-[#0067b8] hover:bg-white/70'
            }`}
          >
            Ops Console →
          </Link>
        ) : null}
      </nav>

      {children}
    </div>
  );
}
