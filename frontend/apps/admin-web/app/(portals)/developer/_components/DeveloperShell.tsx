'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AzureGlyph } from '@pssms/ui';

export const DEVELOPER_TABS = [
  { href: '/developer', label: 'Overview', exact: true },
  { href: '/developer/health', label: 'Health' },
  { href: '/developer/adapters', label: 'Adapters' },
  { href: '/developer/webhooks', label: 'Webhooks' },
  { href: '/developer/outbox', label: 'Outbox' },
  { href: '/developer/notifications', label: 'Notifications' },
  { href: '/developer/logs', label: 'Logs' },
  { href: '/developer/config', label: 'Config' },
] as const;

export function DeveloperShell({
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
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
            <AzureGlyph name="code" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
              Developer
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
        aria-label="Developer sections"
        className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1"
      >
        {DEVELOPER_TABS.map((tab) => {
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
          href="/devices"
          className="ml-auto whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-[#0067b8] hover:bg-white/70"
        >
          Devices →
        </Link>
      </nav>

      {children}
    </div>
  );
}
