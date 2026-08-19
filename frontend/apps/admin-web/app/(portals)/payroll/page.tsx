'use client';

import {
  getPayrollPortalReport,
  type PayrollPortalReport,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  Bell,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOPICS: { title: string; href: string; description: string }[] = [
  {
    title: 'Company & customer cycles',
    href: '/payroll/cycles',
    description:
      'Generate snapshots, submit, approve (HR→Finance→GM→CEO), pay when approved',
  },
  {
    title: 'E-payroll due alerts',
    href: '/payroll/alerts',
    description:
      'Due on the 1st after the period only if the payroll-service invoice is fully paid',
  },
  {
    title: 'Registers & files',
    href: '/payroll/reports',
    description: 'OT, allowances, loans, statutory, alertness from snapshots + CSV',
  },
];

const fmtTZS = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

export default function PayrollOverviewPage() {
  const [pack, setPack] = useState<PayrollPortalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getPayrollPortalReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payroll overview');
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
            Portal 35.16 · Payroll
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Payslips from frozen snapshots
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Used by Payroll Officers, HR Officers, Finance Officers, and approving
            management — mapped to seeded{' '}
            <span className="font-medium text-[#323130]">PAYROLL_OFFICER</span>{' '}
            (<code className="text-[11px]">payroll1@</code>),{' '}
            <span className="font-medium text-[#323130]">HR_OFFICER</span>{' '}
            (<code className="text-[11px]">hr1@</code>),{' '}
            <span className="font-medium text-[#323130]">ACCOUNTS_OFFICER</span>{' '}
            (<code className="text-[11px]">accounts1@</code>), plus GM/CEO/CMD.
            Customer payroll officers use customer-web /payroll (own org only) —
            no extra customer-payroll IAM role. Re-seed to grant{' '}
            <code className="text-[11px]">payroll.manage</code> to HR and Accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className={btnSecondary}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Company net (90d)"
          value={pack ? fmtTZS(pack.company.netPay) : '—'}
          hint={
            pack
              ? `${pack.company.payslipSnapshots} slips · ${pack.company.cycles} cycles`
              : loading
                ? 'Loading…'
                : ''
          }
          icon={<Wallet className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Customer net (90d)"
          value={pack ? fmtTZS(pack.customer.netPay) : '—'}
          hint={
            pack
              ? `${pack.customer.payslipSnapshots} slips · ${pack.customer.cycles} cycles`
              : ''
          }
          icon={<FileSpreadsheet className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Approved / paid net"
          value={pack ? fmtTZS(pack.approvedNetPay) : '—'}
          hint={
            pack
              ? `${pack.unapprovedSnapshots} unapproved slips still in tenant packs`
              : ''
          }
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="E-payroll alerts open"
          value={pack ? pack.dueAlertsOpen : '—'}
          hint="Live DUE status — not limited to the 90-day window"
          icon={<Bell className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {TOPICS.map((t) => (
          <Link key={t.href} href={t.href}>
            <GlassCard className="h-full p-4 transition hover:ring-1 hover:ring-[#c7e0f4]">
              <p className="text-sm font-semibold text-[#1b1a19]">{t.title}</p>
              <p className="mt-1 text-xs text-[#605e5c]">{t.description}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      <GlassCard className="p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#0078d4]" />
          <p className="text-sm font-semibold text-[#1b1a19]">Coverage vs design</p>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#605e5c]">
          <li>
            Guard alertness bonus/penalty and OT hours are frozen on generate — later
            attendance does not change the slip.
          </li>
          <li>
            Customer employee payroll uses access check-in days, never guard
            attendance tables.
          </li>
          <li>
            Statutory NSSF/PAYE are simplified flats (full TRA/SDL/WCF deferred).
          </li>
          <li>
            Happy path: <code className="text-[11px]">payroll1@</code> creates
            the cycle; <code className="text-[11px]">hr1@</code> is first
            approver (creator cannot approve). CMD/CEO often act on /approvals.
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
