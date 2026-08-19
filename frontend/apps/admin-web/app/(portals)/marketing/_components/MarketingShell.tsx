'use client';

import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export const MARKETING_TABS = [
  { href: '/marketing', label: 'Overview', exact: true },
  { href: '/marketing/pipeline', label: 'Pipeline' },
  { href: '/marketing/campaigns', label: 'Campaigns' },
  { href: '/marketing/commissions', label: 'Commissions' },
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === '/marketing';

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#deecf9] text-[#0078d4] ring-1 ring-sky-100">
              <AzureGlyph name="users" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.19 · Marketing &amp; BD
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                Pipeline to contract
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                Leads, surveys, quotes, campaigns, and referral commissions.
                Convert to a customer then a DRAFT contract — approval stays on
                /approvals (creator cannot approve).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Marketing sections"
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
      >
        {MARKETING_TABS.map((tab) => {
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
        <Link
          href="/superadmin/customers"
          className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
        >
          Customers →
        </Link>
      </nav>

      {children}
    </div>
  );
}
