'use client';

import {
  getPayrollPortalReport,
  type PayrollPortalReport,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary, inputCls } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const fmtTZS = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export default function PayrollReportsPage() {
  const [pack, setPack] = useState<PayrollPortalReport | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f?: string, t?: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await getPayrollPortalReport({
        ...(f ? { from: f } : {}),
        ...(t ? { to: t } : {}),
      });
      setPack(next);
      setFrom(toDateInput(next.from));
      setTo(toDateInput(next.to));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const csv = () => {
    if (!pack) return;
    const lines = [
      'metric,count,amount',
      `companyCycles,${pack.company.cycles},${pack.company.netPay}`,
      `customerCycles,${pack.customer.cycles},${pack.customer.netPay}`,
      `companyGross,,${pack.company.grossPay}`,
      `customerGross,,${pack.customer.grossPay}`,
      `approvedNetPay,,${pack.approvedNetPay}`,
      `unapprovedSnapshots,${pack.unapprovedSnapshots},`,
      `companyOvertime,${pack.company.overtime.count},${pack.company.overtime.amount}`,
      `customerOvertime,${pack.customer.overtime.count},${pack.customer.overtime.amount}`,
      `companyAllowances,${pack.company.allowances.count},${pack.company.allowances.amount}`,
      `customerAllowances,${pack.customer.allowances.count},${pack.customer.allowances.amount}`,
      `companyLoans,${pack.company.loanDeductions.count},${pack.company.loanDeductions.amount}`,
      `customerLoans,${pack.customer.loanDeductions.count},${pack.customer.loanDeductions.amount}`,
      `companyNssf,,${pack.company.statutoryNssf}`,
      `customerNssf,,${pack.customer.statutoryNssf}`,
      `companyPaye,,${pack.company.statutoryPaye}`,
      `customerPaye,,${pack.customer.statutoryPaye}`,
      `companyAlertnessBonus,,${pack.company.alertnessBonus}`,
      `customerAlertnessBonus,,${pack.customer.alertnessBonus}`,
      `dueAlertsOpen,${pack.dueAlertsOpen},`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Payroll reports</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Period is matched on cycle period-end. Totals come from frozen
            payslip snapshots (OT, allowances, loans, NSSF/PAYE, guard alertness).
            Per-cycle register / bank / mobile files stay on Cycles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={csv} disabled={!pack}>
            CSV
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={loading}
            onClick={() => void load(from || undefined, to || undefined)}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void load(from || undefined, to || undefined);
        }}
      >
        <label className="text-xs text-[#605e5c]">
          From
          <input
            className={inputCls}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-[#605e5c]">
          To
          <input
            className={inputCls}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button type="submit" className={btnSecondary}>
          Apply
        </button>
      </form>

      {error ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {pack ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Company net"
              value={fmtTZS(pack.company.netPay)}
              hint={`${pack.company.payslipSnapshots} slips · OT ${fmtTZS(pack.company.overtime.amount)}`}
              accent="violet"
            />
            <StatCard
              label="Customer net"
              value={fmtTZS(pack.customer.netPay)}
              hint={`${pack.customer.payslipSnapshots} slips · OT ${fmtTZS(pack.customer.overtime.amount)}`}
              accent="blue"
            />
            <StatCard
              label="Approved / paid net"
              value={fmtTZS(pack.approvedNetPay)}
              hint={`${pack.unapprovedSnapshots} unapproved slips`}
              accent="emerald"
            />
            <StatCard
              label="Company loans"
              value={fmtTZS(pack.company.loanDeductions.amount)}
              hint={`${pack.company.loanDeductions.count} lines`}
              accent="amber"
            />
            <StatCard
              label="Company statutory"
              value={fmtTZS(pack.company.statutoryNssf + pack.company.statutoryPaye)}
              hint={`NSSF ${fmtTZS(pack.company.statutoryNssf)} · PAYE ${fmtTZS(pack.company.statutoryPaye)}`}
              accent="sky"
            />
            <StatCard
              label="Guard alertness (company)"
              value={fmtTZS(pack.company.alertnessBonus - pack.company.alertnessPenalty)}
              hint={`Bonus ${fmtTZS(pack.company.alertnessBonus)} · ${pack.company.alertnessMissed} missed`}
              accent="blue"
            />
          </div>
          <GlassCard className="mt-4 p-4">
            <p className="text-sm font-semibold text-[#1b1a19]">Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#605e5c]">
              {pack.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                Cycle register and bank/mobile files:{' '}
                <Link className="text-[#0067b8]" href="/payroll/cycles">
                  /payroll/cycles
                </Link>
              </li>
            </ul>
          </GlassCard>
        </>
      ) : null}
    </>
  );
}
