'use client';

import {
  listMyCustomerPayslips,
  type CustomerPayslip,
} from '@pssms/api-client';
import { Banknote, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  formatDate,
  money,
} from '../../_components/portal-ui';

export default function MyPayslipsPage() {
  const [rows, setRows] = useState<CustomerPayslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerPayslip | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMyCustomerPayslips());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestNet = rows[0]?.netPay ?? 0;

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Finance · My pay"
        title="My payslips"
        subtitle="Your customer-managed payroll history — only payslips linked to your employee profile."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <PortalStat label="Payslips" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat
          label="Latest net pay"
          value={loading || rows.length === 0 ? '—' : money(latestNet, 'TZS')}
          tone="emerald"
        />
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#edebe9]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <PortalEmpty
          title="No payslips yet"
          description="Payslips appear here after HIGHLINK runs customer payroll for your organisation and your profile is on the roster."
          icon={<Banknote className="h-4 w-4" />}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setDetail(p)}
                className="flex w-full items-center justify-between rounded-xl border border-[#e1dfdd] bg-white px-4 py-3 text-left shadow-sm hover:border-[#0078d4]/40"
              >
                <div>
                  <p className="font-semibold text-[#323130]">
                    {formatDate(p.createdAt)}
                  </p>
                  <p className="text-xs text-[#605e5c]">{p.employeeNumber}</p>
                </div>
                <p className="text-sm font-semibold text-[#107c10]">
                  {money(p.netPay, 'TZS')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold">Payslip detail</h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg p-1 hover:bg-[#f3f2f1]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#605e5c]">Gross</dt>
                <dd className="font-medium">{money(detail.grossPay, 'TZS')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#605e5c]">Deductions</dt>
                <dd className="font-medium">
                  {money(detail.totalDeductions, 'TZS')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#edebe9] pt-2">
                <dt className="font-semibold">Net pay</dt>
                <dd className="font-semibold text-[#107c10]">
                  {money(detail.netPay, 'TZS')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
