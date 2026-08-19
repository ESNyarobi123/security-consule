'use client';

import { AzureGlyph } from '@pssms/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { WALL } from './shared';

export const CCTV_TABS = [
  { href: '/cctv', label: 'Wall', exact: true },
  { href: '/cctv/alerts', label: 'Alerts' },
  { href: '/cctv/parking', label: 'Parking' },
  { href: '/cctv/access', label: 'Access' },
  { href: '/cctv/patrols', label: 'Patrols' },
  { href: '/cctv/alarms', label: 'Alarms' },
  { href: '/cctv/incidents', label: 'Incidents' },
] as const;

export function CctvShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWall = pathname === '/cctv';

  return (
    <div className={isWall ? undefined : 'pb-6'}>
      {!isWall ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#e1dfdd] pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#deecf9] text-[#0078d4] ring-1 ring-sky-100">
              <AzureGlyph name="video" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#605e5c]">
                Portal 35.22 · CCTV &amp; Security Monitoring
              </p>
              <h1 className="text-lg font-semibold leading-tight text-[#1b1a19]">
                Control room monitors
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
                Live parking, access, patrols, alarms, and incidents for CCTV
                operators and Control Room. Video stays on the NVR. Field
                mutate stays Branch Ops. Customers stay customer-web.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="CCTV monitoring sections"
        className={`mb-4 flex gap-1 overflow-x-auto rounded-lg p-1 ${
          isWall
            ? 'border border-white/10'
            : 'border border-[#e1dfdd] bg-[#faf9f8]'
        }`}
        style={isWall ? { background: WALL.bgSoft } : undefined}
      >
        {CCTV_TABS.map((tab) => {
          const exact = 'exact' in tab && tab.exact;
          const active = exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isWall
                  ? active
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  : active
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
