'use client';

import {
  getPayrollPortalReport,
  listPayrollCycles,
  type PayrollCycle,
  type PayrollPortalReport,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnPrimary, btnSecondary } from '@pssms/ui';
import { ArrowUpRight, Banknote, RefreshCw, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function money(amount: number, currency = 'TZS') {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  CALCULATED: 'bg-sky-50 text-sky-700 ring-sky-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PAID: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
};

export default function FinancePayrollPage() {
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [report, setReport] = useState<PayrollPortalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<'ALL' | 'COMPANY' | 'CUSTOMER'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cycleRows, reportPack] = await Promise.all([
        listPayrollCycles(),
        getPayrollPortalReport().catch(() => null),
      ]);
      setCycles(cycleRows);
      setReport(reportPack);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (tenant === 'ALL') return cycles;
    return cycles.filter((c) => {
      const t = (c.tenantType ?? '').toUpperCase();
      return tenant === 'COMPANY' ? t !== 'CUSTOMER_MANAGED_PAYROLL' : t === 'CUSTOMER_MANAGED_PAYROLL';
    });
  }, [cycles, tenant]);

  const stats = useMemo(() => {
    const company = report?.company;
    const customer = report?.customer;
    const net =
      (company?.netPay ?? 0) + (customer?.netPay ?? 0);
    return {
      cycles: cycles.length,
      snapshots: report?.company.payslipSnapshots ?? 0,
      net,
      loans: (company?.loanDeductions.amount ?? 0) + (customer?.loanDeductions.amount ?? 0),
      unapproved: report?.unapprovedSnapshots ?? 0,
      dueAlerts: report?.dueAlertsOpen ?? 0,
    };
  }, [cycles, report]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Payroll</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Finance view of company and customer-managed payroll. Amounts come from
            immutable payslip snapshots — never recomputed from live attendance.
            Approvals follow HR → Finance → GM → CEO; pay is blocked until the cycle
            is APPROVED.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/payroll/cycles" className={btnPrimary}>
            Open payroll console
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error} — payroll needs <code>payroll.manage</code>. Ask the Payroll
          Officer (Portal 35.16) to grant it, or approve through{' '}
          <Link href="/approvals" className="underline">
            Approvals
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Payroll cycles"
          value={stats.cycles}
          hint={`${stats.snapshots} payslip snapshots`}
          accent="blue"
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Net pay (30d)"
          value={money(stats.net)}
          hint="Company + customer payroll"
          accent="emerald"
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          label="Loan deductions (30d)"
          value={money(stats.loans)}
          hint="Recovered through payroll"
          accent="violet"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting action"
          value={stats.unapproved}
          hint={`${stats.dueAlerts} e-payroll due alert${
            stats.dueAlerts === 1 ? '' : 's'
          }`}
          accent="amber"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <GlassCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#1b1a19]">Payroll cycles</p>
            <p className="text-[11px] text-[#605e5c]">
              Company payroll and customer-managed payroll are separate calculations
              (design §18/§19).
            </p>
          </div>
          <div className="flex gap-1">
            {(['ALL', 'COMPANY', 'CUSTOMER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTenant(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  tenant === t
                    ? 'bg-[#0078d4] text-white shadow-sm'
                    : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'COMPANY' ? 'Company' : 'Customer'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
              <tr>
                <th className="px-3 py-2">Cycle</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Paid ref</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && cycles.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={6}>
                    Loading payroll cycles…
                  </td>
                </tr>
              ) : null}
              {!loading && visible.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-xs text-[#8a8886]" colSpan={6}>
                    No payroll cycles for this filter.
                  </td>
                </tr>
              ) : null}
              {visible.map((c) => {
                const isCustomer = (c.tenantType ?? '').toUpperCase() ===
                  'CUSTOMER_MANAGED_PAYROLL';
                return (
                  <tr key={c.id} className="border-t border-[#edebe9]">
                    <td className="px-3 py-2 font-medium">{c.cycleCode}</td>
                    <td className="px-3 py-2 text-xs text-[#605e5c]">
                      {fmtDate(c.periodStart)} → {fmtDate(c.periodEnd)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ring-1 ${
                          isCustomer
                            ? 'bg-violet-50 text-violet-700 ring-violet-200'
                            : 'bg-sky-50 text-sky-700 ring-sky-200'
                        }`}
                      >
                        {isCustomer ? 'Customer payroll' : 'Company payroll'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                          STATUS_STYLE[c.status] ??
                          'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}
                      >
                        {c.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#605e5c]">
                      {c.paymentReference || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href="/payroll/cycles"
                        className="text-xs font-medium text-[#0078d4] hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-sm font-semibold text-[#1b1a19]">Coverage vs design</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#605e5c]">
          <li>
            Company payroll (<code>INTERNAL_COMPANY</code>) and customer-managed
            payroll (<code>CUSTOMER_MANAGED_PAYROLL</code>) stay separate; customer
            officers use customer-web <Link className="text-[#0067b8]" href="/payroll">/payroll</Link>.
          </li>
          <li>
            Loan deductions are recovered from immutable snapshots — the same figures
            appear on the Loans statement.
          </li>
          <li>
            Bank/mobile-money disbursement files stay on the payroll console
            (approved/paid cycles only).
          </li>
          <li>
            E-payroll due alerts fire on the 1st of the month only when the linked
            invoice is fully paid.
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
