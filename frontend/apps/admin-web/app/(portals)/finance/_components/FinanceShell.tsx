'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

export const FINANCE_TABS = [
  { href: '/finance', label: 'Overview', exact: true },
  { href: '/finance/invoices', label: 'Invoices' },
  { href: '/finance/petty-cash', label: 'Petty cash' },
  { href: '/finance/vouchers', label: 'Payment vouchers' },
  { href: '/finance/reports', label: 'Reports' },
] as const;

export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useMemo(() => getSessionUser(), []);
  const isOverview = pathname === '/finance';

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e6f4ea] text-[#107c10] ring-1 ring-emerald-100">
              <AzureGlyph name="wallet" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.15 · Finance & Accounts
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                Money in, money out
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                Invoices, receipts, petty cash, and payment vouchers. Payroll and
                loan deductions stay on Portal 35.16. Creator cannot approve or
                pay their own voucher.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Finance sections"
        className={`mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 ${
          isOverview
            ? 'border-[#e1dfdd] bg-[#faf9f8]'
            : 'border-[#e1dfdd] bg-[#faf9f8]'
        }`}
      >
        {FINANCE_TABS.map((tab) => {
          const exact = 'exact' in tab && tab.exact;
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
        {can(session, 'payroll.manage') ? (
          <Link
            href="/payroll"
            className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
          >
            Payroll →
          </Link>
        ) : null}
        {can(session, 'loans.manage') ? (
          <Link
            href="/loans"
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
          >
            Loans →
          </Link>
        ) : null}
      </nav>

      {children}
    </div>
  );
}
