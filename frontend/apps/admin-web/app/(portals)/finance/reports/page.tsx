'use client';

import { getFinanceReports, type FinanceReport } from '@pssms/api-client';
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

export default function FinanceReportsPage() {
  const [pack, setPack] = useState<FinanceReport | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f?: string, t?: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await getFinanceReports({
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

  const onFilter = (e: FormEvent) => {
    e.preventDefault();
    void load(from || undefined, to || undefined);
  };

  const csv = () => {
    if (!pack) return;
    const lines = [
      'metric,count,amount',
      `invoicesIssued,${pack.invoicesIssued.count},${pack.invoicesIssued.amount}`,
      `customerReceipts,${pack.customerReceipts.count},${pack.customerReceipts.amount}`,
      `outstanding,${pack.outstanding.count},${pack.outstanding.amount}`,
      `parkingBilled,${pack.parkingBilled.count},${pack.parkingBilled.amount}`,
      `parkingReceipts,${pack.parkingReceipts.count},${pack.parkingReceipts.amount}`,
      `pettyCashIssued,${pack.pettyCashIssued.count},${pack.pettyCashIssued.amount}`,
      `pettyCashRetired,${pack.pettyCashRetired.count},${pack.pettyCashRetired.amount}`,
      `supplierPayments,${pack.supplierPayments.count},${pack.supplierPayments.amount}`,
      `paymentVouchersPaid,${pack.paymentVouchersPaid.count},${pack.paymentVouchersPaid.amount}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">Financial reports</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            Live Prisma counts for this organization — not executive KPI forecasts.
            Payroll / loan deduction registers stay on Portal 35.16.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={csv} disabled={!pack}>
            CSV
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void load(from || undefined, to || undefined)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={onFilter}>
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
              label="Invoices issued"
              value={fmtTZS(pack.invoicesIssued.amount)}
              hint={`${pack.invoicesIssued.count} in period`}
              accent="blue"
            />
            <StatCard
              label="Customer receipts"
              value={fmtTZS(pack.customerReceipts.amount)}
              hint={`${pack.customerReceipts.count} payments`}
              accent="emerald"
            />
            <StatCard
              label="Outstanding AR"
              value={fmtTZS(pack.outstanding.amount)}
              hint={`${pack.outstanding.count} open`}
              accent="amber"
            />
            <StatCard
              label="Parking billed"
              value={fmtTZS(pack.parkingBilled.amount)}
              hint={`${pack.parkingBilled.count} invoices`}
              accent="sky"
            />
            <StatCard
              label="Petty cash issued"
              value={fmtTZS(pack.pettyCashIssued.amount)}
              hint={`${pack.pettyCashIssued.count} issues`}
              accent="blue"
            />
            <StatCard
              label="AP paid"
              value={fmtTZS(pack.paymentVouchersPaid.amount)}
              hint={`${pack.supplierPayments.count} with supplier id`}
              accent="emerald"
            />
          </div>

          <GlassCard className="mt-4 p-4">
            <p className="text-sm font-semibold text-[#1b1a19]">Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#605e5c]">
              {pack.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                Bank reconciliation implemented:{' '}
                {pack.bankReconciliationImplemented ? 'yes' : 'no (deferred)'}.
              </li>
              <li>
                Company payroll register:{' '}
                <Link className="text-[#0067b8]" href="/payroll">
                  /payroll
                </Link>
              </li>
            </ul>
          </GlassCard>
        </>
      ) : null}
    </>
  );
}
