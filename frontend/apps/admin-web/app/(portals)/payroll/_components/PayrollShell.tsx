'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, type ReactNode } from 'react';

type PayrollTab = { href: string; label: string; exact?: boolean };

const CONSOLE_TABS: readonly PayrollTab[] = [
  { href: '/payroll', label: 'Overview', exact: true },
  { href: '/payroll/cycles', label: 'Cycles' },
  { href: '/payroll/alerts', label: 'E-payroll alerts' },
  { href: '/payroll/reports', label: 'Reports' },
  { href: '/payroll/me', label: 'My payslips' },
];

const SELF_TABS: readonly PayrollTab[] = [
  { href: '/payroll', label: 'My payslips', exact: true },
];

/** Console routes that must never render for a non-payroll manager. */
function isConsolePath(pathname: string): boolean {
  return (
    pathname !== '/payroll' &&
    pathname !== '/payroll/me' &&
    pathname.startsWith('/payroll')
  );
}

export function PayrollShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useMemo(() => getSessionUser(), []);
  const canManage = can(session, 'payroll.manage');
  const isOverview = pathname === '/payroll' || pathname === '/payroll/me';
  const isSelfView = pathname === '/payroll/me' || (!canManage && pathname === '/payroll');
  const tabs = canManage ? CONSOLE_TABS : SELF_TABS;

  // Employees only get the self-service surface — never the payroll console.
  useEffect(() => {
    if (!session) return;
    if (!canManage && isConsolePath(pathname)) {
      router.replace('/payroll');
    }
  }, [canManage, pathname, router, session]);

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f3e8ff] text-[#5c2d91] ring-1 ring-violet-100">
              <AzureGlyph name="wallet" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.16 · Payroll
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                {isSelfView
                  ? 'My payslips'
                  : 'Company & customer payroll'}
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                {isSelfView
                  ? 'Your own immutable payslip snapshots, leave and loan position. Company-wide payroll stays hidden — no admin-granted permission is needed to see your own records.'
                  : 'Immutable payslip snapshots. Approval HR → Finance → GM → CEO before pay. Customer officers use customer-web, not this console. Use “My payslips” for your own slip.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {tabs.length > 1 ? (
        <nav
          aria-label="Payroll sections"
          className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
        >
          {tabs.map((tab) => {
            const exact = tab.exact;
            const active = exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white text-[#0078d4] shadow-sm ring-1 ring-[#e1dfdd]'
                    : 'text-[#605e5c] hover:bg-white/70 hover:text-[#323130]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
          {canManage && can(session, 'loans.manage') ? (
            <Link
              href="/loans"
              className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
            >
              Loans →
            </Link>
          ) : null}
          {canManage && can(session, 'finance.manage') ? (
            <Link
              href="/finance"
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
            >
              Finance →
            </Link>
          ) : null}
        </nav>
      ) : null}

      {!canManage && isConsolePath(pathname) ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This section is for payroll officers. Redirecting to your own
          payslips…
        </p>
      ) : (
        children
      )}
    </div>
  );
}
