'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard } from '@pssms/ui';
import Link from 'next/link';
import { useMemo } from 'react';

const LINKS: {
  href: string;
  title: string;
  description: string;
  permission?: string;
}[] = [
  {
    href: '/branch/sites',
    title: 'Sites',
    description: 'Customer / facility sites under branches',
    permission: 'operations.manage',
  },
  {
    href: '/branch/access-points',
    title: 'Access points',
    description: 'Gates on sites — pedestrian, vehicle, mixed',
    permission: 'operations.manage',
  },
  {
    href: '/ess/requests',
    title: 'ESS requests',
    description: 'Your own leave, loan, and movement status',
    permission: 'ess.access',
  },
  {
    href: '/finance/petty-cash',
    title: 'Petty cash',
    description: 'Imprest issue and retire (no issue without approval)',
    permission: 'finance.manage',
  },
  {
    href: '/ess/petty-cash',
    title: 'Apply petty cash',
    description: 'Employee imprest request from self-service',
    permission: 'ess.access',
  },
  {
    href: '/assets',
    title: 'Assets & equipment',
    description: 'Register, assign, and returns',
    permission: 'assets.manage',
  },
];

export default function AdministrationOfficePage() {
  const session = useMemo(() => getSessionUser(), []);
  const visible = LINKS.filter(
    (l) => !l.permission || can(session, l.permission),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">
          Office operations
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
          Day-to-day office work uses the existing domain portals — not a
          second set of tables. Correspondence/mail registry is not a separate
          module in this slice.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((l) => (
          <Link key={l.href} href={l.href}>
            <GlassCard
              glow="none"
              className="h-full p-4 transition hover:border-[#0078d4]/40"
            >
              <p className="text-sm font-semibold text-[#1b1a19]">{l.title}</p>
              <p className="mt-1 text-sm text-[#605e5c]">{l.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[#605e5c]">
          No office operation shortcuts for this role. Company records stay on
          the Company tab.
        </p>
      ) : null}
    </div>
  );
}
