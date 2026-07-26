'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AzureGlyph } from '@pssms/ui';

export const COMPLIANCE_TABS = [
  {
    href: '/compliance',
    label: 'Overview',
    exact: true,
    permission: 'audit.read',
  },
  {
    href: '/compliance/policies',
    label: 'Policies',
    permission: 'compliance.manage',
  },
  {
    href: '/compliance/breaches',
    label: 'Breaches',
    permission: 'compliance.manage',
  },
] as const;

export function ComplianceShell({
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
  const sessionUser = useMemo(() => getSessionUser(), []);
  const tabs = COMPLIANCE_TABS.filter((tab) =>
    can(sessionUser, tab.permission),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
            <AzureGlyph name="shield" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
              Compliance / DPO
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
        aria-label="Compliance sections"
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
        {can(sessionUser, 'approvals.act') ? (
          <Link
            href="/approvals"
            className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
          >
            Approvals →
          </Link>
        ) : null}
      </nav>

      {children}
    </div>
  );
}
