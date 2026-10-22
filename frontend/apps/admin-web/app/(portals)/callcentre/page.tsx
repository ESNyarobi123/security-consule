'use client';

import {
  getCallCentreReports,
  type CallCentreReport,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  CalendarClock,
  Car,
  Headset,
  MessageSquareWarning,
  RefreshCw,
  Ticket,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const TOPICS: {
  title: string;
  href: string;
  description: string;
  permission: string;
  alsoPermits?: string[];
}[] = [
  {
    title: 'Visitor support',
    href: '/callcentre/visitors',
    description:
      'Appointments, host approve, gate entries, ID scans — needs visitor ops access',
    permission: 'visitors.manage',
  },
  {
    title: 'Customer complaints',
    href: '/callcentre/complaints',
    description:
      'Module 6-B register — read the description, triage status, creator ≠ processor',
    permission: 'support.manage',
    alsoPermits: ['visitors.manage'],
  },
  {
    title: 'Support tickets',
    href: '/callcentre/tickets',
    description:
      'Coverage, parking, supplier, payroll, visitor, and incident inquiries',
    permission: 'support.manage',
    alsoPermits: ['visitors.manage'],
  },
];

export default function CallCentreOverviewPage() {
  const session = useMemo(() => getSessionUser(), []);
  const [pack, setPack] = useState<CallCentreReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCallCentreReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support desk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topics = TOPICS.filter((t) => {
    if (can(session, t.permission)) return true;
    return (t.alsoPermits ?? []).some((code) => can(session, code));
  });

  const ticketStatuses = pack?.ticketsByStatus ?? {};
  const complaintStatuses = pack?.complaintsByStatus ?? {};

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5c2d91]">
            Portal 35.20 · Call Centre &amp; Support
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Hear it, log it, escalate it
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Used by Call Centre Agents (<code className="text-[11px]">callcentre1@</code>
            ), Customer Support Officers (<code className="text-[11px]">cs1@</code>),
            Helpdesk Officers (<code className="text-[11px]">it1@</code>), and
            Supervisors (<code className="text-[11px]">supervisor1@</code>).
            Visitor gate work still needs <code className="text-[11px]">visitors.manage</code>;
            the desk itself runs on <code className="text-[11px]">support.manage</code>.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={loading ? '…' : (pack?.openTickets ?? 0)}
          hint={`${pack?.escalatedTickets ?? 0} escalated to Branch Ops`}
          icon={<Ticket className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Open complaints"
          value={loading ? '…' : (pack?.openComplaints ?? 0)}
          hint={`${complaintStatuses.OPEN ?? 0} untouched · ${complaintStatuses.UNDER_REVIEW ?? 0} under review`}
          icon={<MessageSquareWarning className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="Pending visits"
          value={loading ? '…' : (pack?.pendingVisitorAppointments ?? 0)}
          hint={`${pack?.gateEntriesToday ?? 0} gate punches today`}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Parking / supplier / payroll"
          value={
            loading
              ? '…'
              : (pack?.parkingInquiries ?? 0) +
                (pack?.supplierInquiries ?? 0) +
                (pack?.payrollInquiries ?? 0)
          }
          hint="Logged as tickets — not those portals’ ledgers"
          icon={<Headset className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <GlassCard className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Car className="h-4 w-4" /> Parking support
          </p>
          <p className="mt-1 text-2xl font-semibold">{pack?.parkingInquiries ?? '—'}</p>
          <p className="text-xs text-[#605e5c]">Ticket category PARKING</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4" /> Supplier inquiries
          </p>
          <p className="mt-1 text-2xl font-semibold">{pack?.supplierInquiries ?? '—'}</p>
          <p className="text-xs text-[#605e5c]">Ticket category SUPPLIER</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4" /> Payroll inquiries
          </p>
          <p className="mt-1 text-2xl font-semibold">{pack?.payrollInquiries ?? '—'}</p>
          <p className="text-xs text-[#605e5c]">Ticket category PAYROLL</p>
        </GlassCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <GlassCard className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ticket className="h-4 w-4" /> Tickets by status
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-[#605e5c] sm:grid-cols-3">
            {['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(
              (s) => (
                <li key={s} className="flex items-center justify-between gap-2">
                  <span>{s.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="font-semibold text-[#1b1a19]">
                    {ticketStatuses[s] ?? 0}
                  </span>
                </li>
              ),
            )}
          </ul>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4" /> Complaints by status
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs text-[#605e5c] sm:grid-cols-3">
            {['OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'].map(
              (s) => (
                <li key={s} className="flex items-center justify-between gap-2">
                  <span>{s.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="font-semibold text-[#1b1a19]">
                    {complaintStatuses[s] ?? 0}
                  </span>
                </li>
              ),
            )}
          </ul>
        </GlassCard>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {topics.map((t) => (
          <Link key={t.href} href={t.href}>
            <GlassCard className="h-full p-4 transition hover:ring-1 hover:ring-[#0078d4]/30">
              <p className="text-sm font-semibold text-[#1b1a19]">{t.title}</p>
              <p className="mt-1 text-xs text-[#605e5c]">{t.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      {session?.roles?.includes('SUPERVISOR') ? (
        <p className="flex items-center gap-2 text-xs text-[#605e5c]">
          <Users className="h-3.5 w-3.5" />
          As a Supervisor you triage complaints and tickets here; field incidents
          and deployments stay on{' '}
          <Link href="/branch" className="font-medium text-[#0067b8] hover:underline">
            Branch Ops
          </Link>
          .
        </p>
      ) : null}

      {pack?.notes?.length ? (
        <p className="text-xs text-[#605e5c]">{pack.notes.join(' ')}</p>
      ) : null}
    </div>
  );
}
