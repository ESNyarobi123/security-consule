'use client';

import {
  getFinanceReports,
  type FinanceReport,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  Banknote,
  FileSpreadsheet,
  Car,
  Receipt,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOPICS: { title: string; href: string; description: string }[] = [
  {
    title: 'Invoices & customer receipts',
    href: '/finance/invoices',
    description: 'Issue, collect, dispute, close — including parking bills',
  },
  {
    title: 'Petty cash',
    href: '/finance/petty-cash',
    description: 'Approve → issue → retire with receipt (no issue without approval)',
  },
  {
    title: 'Payment vouchers',
    href: '/finance/vouchers',
    description: 'Supplier / AP payees — create, approve, pay (creator ≠ actor)',
  },
  {
    title: 'Financial reports',
    href: '/finance/reports',
    description: 'Live counts for invoices, receipts, petty cash, and AP',
  },
];

const fmtTZS = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

export default function FinanceOverviewPage() {
  const [pack, setPack] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getFinanceReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance overview');
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#107c10]">
            Portal 35.15 · Finance & Accounts
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Invoices, cash, and vouchers
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Used by Finance Director, Chief Accountant, Accountants, Cashiers, and
            authorized management — mapped to seeded{' '}
            <span className="font-medium text-[#323130]">ACCOUNTS_OFFICER</span>{' '}
            (<code className="text-[11px]">accounts1@</code>) and GM/CEO/CMD. Payroll
            Officers use Portal 35.16 (<code className="text-[11px]">payroll1@</code>
            ). Internal Auditor uses Compliance/Audit and does not receive{' '}
            <code className="text-[11px]">finance.manage</code>. No extra cashier or
            finance-director IAM roles.
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
          label="Outstanding AR"
          value={pack ? fmtTZS(pack.outstanding.amount) : '—'}
          hint={pack ? `${pack.outstanding.count} open invoices` : loading ? 'Loading…' : ''}
          icon={<Receipt className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Customer receipts (30d)"
          value={pack ? fmtTZS(pack.customerReceipts.amount) : '—'}
          hint={pack ? `${pack.customerReceipts.count} payments` : ''}
          icon={<Banknote className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="AP vouchers paid (30d)"
          value={pack ? fmtTZS(pack.paymentVouchersPaid.amount) : '—'}
          hint={pack ? `${pack.paymentVouchersPaid.count} paid` : ''}
          icon={<Wallet className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Parking billed (30d)"
          value={pack ? fmtTZS(pack.parkingBilled.amount) : '—'}
          hint={pack ? `${pack.parkingBilled.count} parking invoices` : ''}
          icon={<Car className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
          <FileSpreadsheet className="h-4 w-4 text-[#0078d4]" />
          <p className="text-sm font-semibold text-[#1b1a19]">Coverage vs design</p>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#605e5c]">
          <li>
            Receipts in the KPI = customer invoice payments (30 days). Petty-cash
            retire attachments live on the Petty cash tab (MinIO).
          </li>
          <li>
            Supplier payments = AP payment vouchers (optional supplier id) plus
            procurement submission mark-paid on <Link className="text-[#0067b8]" href="/procurement/buying">/procurement/buying</Link>.
          </li>
          <li>
            Loan deductions stay on{' '}
            <Link className="text-[#0067b8]" href="/payroll">/payroll</Link> snapshots.
          </li>
          <li>
            Bank reconciliations are not built (no statement import). Payment
            references are stored for a later matching engine.
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
