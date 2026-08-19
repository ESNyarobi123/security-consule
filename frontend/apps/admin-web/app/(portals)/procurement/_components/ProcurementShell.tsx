'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

export function ProcurementShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useMemo(() => getSessionUser(), []);
  const isOverview = pathname === '/procurement';
  const canBuy = can(session, 'procurement.manage');
  const canStock = can(session, 'inventory.manage');
  const canAssets = can(session, 'assets.manage');

  const tabs = [
    canBuy || canStock
      ? { href: '/procurement', label: 'Overview', exact: true }
      : null,
    canBuy ? { href: '/procurement/buying', label: 'Buying' } : null,
    canStock ? { href: '/procurement/inventory', label: 'Inventory' } : null,
    canAssets ? { href: '/assets', label: 'Issued assets' } : null,
  ].filter(Boolean) as { href: string; label: string; exact?: boolean }[];

  return (
    <div className={isOverview ? 'pb-6' : undefined}>
      {!isOverview ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff4ce] text-[#9a3412] ring-1 ring-amber-100">
              <AzureGlyph name="cart" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.18 · Procurement & Inventory
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                Buy, receive, stock, issue
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                Purchase requests, supplier comparison, POs, GRNs, and store
                stock. Serialized kit issued to staff is on Assets. Vendors use
                35.17. Creator cannot approve their own PR/PO.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Procurement sections"
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
      >
        {tabs.map((tab) => {
          const exact = Boolean(tab.exact);
          const active = exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={`${tab.label}-${tab.href}`}
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
        {can(session, 'approvals.act') ? (
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
