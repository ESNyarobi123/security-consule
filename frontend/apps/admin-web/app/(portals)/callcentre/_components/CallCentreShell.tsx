'use client';

import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export const CALLCENTRE_TABS = [
  { href: '/callcentre', label: 'Overview', exact: true },
  { href: '/callcentre/visitors', label: 'Visitors' },
  { href: '/callcentre/complaints', label: 'Complaints' },
  { href: '/callcentre/tickets', label: 'Tickets' },
] as const;

export function CallCentreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === '/callcentre';

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f3e8ff] text-[#5c2d91] ring-1 ring-violet-100">
              <AzureGlyph name="headset" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.20 · Call Centre &amp; Support
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                Inquiries and escalations
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                Complaints, visitor support, and tickets for parking / supplier /
                payroll inquiries. Escalate a ticket to Branch Ops as an
                incident. Creator cannot process their own ticket.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Call Centre sections"
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
      >
        {CALLCENTRE_TABS.map((tab) => {
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
      </nav>
      {children}
    </div>
  );
}
