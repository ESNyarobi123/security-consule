'use client';

import {
  getCallCentreReports,
  type CallCentreReport,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  CalendarClock,
  Car,
  Headset,
  MessageSquareWarning,
  RefreshCw,
  Ticket,
  Truck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOPICS: { title: string; href: string; description: string }[] = [
  {
    title: 'Visitor support',
    href: '/callcentre/visitors',
    description: 'Appointments, host approve, gate entries, ID scans',
  },
  {
    title: 'Customer complaints',
    href: '/callcentre/complaints',
    description: 'Module 6-B register — creator cannot process own complaint',
  },
  {
    title: 'Support tickets',
    href: '/callcentre/tickets',
    description:
      'Coverage, parking, supplier, payroll, visitor, and incident inquiries',
  },
];

export default function CallCentreOverviewPage() {
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
            Used by Call Centre Agents and Customer Support Officers on seeded{' '}
            <code className="text-[11px]">CALL_CENTRE</code> (
            <code className="text-[11px]">callcentre1@</code>). Helpdesk Officers
            stay IT Support (<code className="text-[11px]">it1@</code>).
            Supervisors stay Branch Ops for field incidents. No extra agent roles.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
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
          hint="All support categories"
          icon={<Ticket className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Open complaints"
          value={loading ? '…' : (pack?.openComplaints ?? 0)}
          hint="Customer complaint register"
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

      <div className="grid gap-3 md:grid-cols-3">
        {TOPICS.map((t) => (
          <Link key={t.href} href={t.href}>
            <GlassCard className="h-full p-4 transition hover:ring-1 hover:ring-[#0078d4]/30">
              <p className="text-sm font-semibold text-[#1b1a19]">{t.title}</p>
              <p className="mt-1 text-xs text-[#605e5c]">{t.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      {pack?.notes?.length ? (
        <p className="text-xs text-[#605e5c]">{pack.notes.join(' ')}</p>
      ) : null}
    </div>
  );
}
