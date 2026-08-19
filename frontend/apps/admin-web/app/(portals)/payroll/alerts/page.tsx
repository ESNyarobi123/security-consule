'use client';

import {
  listPayrollDueAlerts,
  scanPayrollDueAlerts,
  type PayrollDueAlert,
} from '@pssms/api-client';
import { btnSecondary } from '@pssms/ui';
import { Bell, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const money = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

export default function PayrollAlertsPage() {
  const [alerts, setAlerts] = useState<PayrollDueAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanBusy, setScanBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await listPayrollDueAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">
            Electronic payroll due alerts
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-[#605e5c]">
            For customer-managed payroll: due on the 1st of the month after the
            period, only if the related invoice is fully PAID. Mark-paid is
            blocked on unpaid/partial/disputed invoices unless GM/CEO/CMD grant
            an exception on the cycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={scanBusy}
            onClick={async () => {
              setScanBusy(true);
              setError(null);
              try {
                const res = await scanPayrollDueAlerts(false);
                setNote(
                  `Scan: ${res.alertsCreated} alert(s), ${res.skippedUnpaid} unpaid skipped`,
                );
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Scan failed');
              } finally {
                setScanBusy(false);
              }
            }}
          >
            <Bell className="h-4 w-4" />
            {scanBusy ? 'Scanning…' : 'Scan due alerts'}
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={scanBusy}
            onClick={async () => {
              setScanBusy(true);
              setError(null);
              try {
                const res = await scanPayrollDueAlerts(true);
                setNote(
                  `Force scan (smoke): ${res.alertsCreated} alert(s), ${res.skippedUnpaid} unpaid skipped`,
                );
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Scan failed');
              } finally {
                setScanBusy(false);
              }
            }}
          >
            Force scan
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mb-3 rounded-lg border border-[#c7e0f4] bg-[#eff6fc] px-3 py-2 text-xs text-[#005a9e]">
          {note}
        </p>
      ) : null}

      {loading && alerts.length === 0 ? (
        <p className="text-xs text-[#8a8886]">Loading…</p>
      ) : null}

      {!loading && alerts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#e1dfdd] px-4 py-6 text-sm text-[#605e5c]">
          No e-payroll due alerts. Customer cycles still require a fully paid
          payroll-service invoice before mark-paid (unless exception).
        </p>
      ) : null}

      <ul className="space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="rounded-lg border border-[#e1dfdd] bg-white px-4 py-3"
          >
            <p className="text-sm font-semibold text-[#323130]">
              {a.customerName ?? a.customerCode} · {a.payrollMonth}
            </p>
            <p className="mt-1 text-xs text-[#605e5c]">
              Invoice {a.invoiceNumber ?? '—'} · paid {money(a.invoiceAmountPaid)}{' '}
              · {a.employeesCovered} employees · due {a.dueDate.slice(0, 10)} ·
              portion {money(a.payrollPortionDue)} · invoice{' '}
              {a.invoicePaymentStatus} · approval {a.payrollApprovalStatus} ·
              officer {a.responsibleOfficerName ?? '—'}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
