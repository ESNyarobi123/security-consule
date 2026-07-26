'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AzureGlyph } from '@pssms/ui';

export const HR_TABS = [
  { href: '/hr', label: 'Overview', exact: true },
  { href: '/hr/employees', label: 'Employees' },
  { href: '/hr/leave', label: 'Leave' },
  { href: '/hr/salary', label: 'Salary' },
  { href: '/hr/training', label: 'Training' },
  { href: '/hr/discipline', label: 'Discipline' },
  { href: '/hr/movements', label: 'Movements' },
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff4ce] text-[#8a6914]">
            <AzureGlyph name="users" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
              HR
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
        {HR_TABS.map((tab) => {
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
