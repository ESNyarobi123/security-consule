'use client';

import { getCustomerReport, type CustomerReport } from '@pssms/api-client';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'TZS',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

function downloadCsv(report: CustomerReport) {
  const s = report.summary;
  const lines = [
    ['Metric', 'Value'],
    ['Customer', `${report.code} · ${report.name}`],
    ['From', report.period.from],
    ['To', report.period.to],
    ['Incidents opened', String(s.incidentsOpened)],
    ['Clock-ins', String(s.attendanceClockIns)],
    ['Access entries', String(s.accessEntries)],
    ['Visitor appointments', String(s.visitorAppointments)],
    ['Parking entries', String(s.parkingEntries)],
    ['Complaints opened', String(s.complaintsOpened)],
    ['Invoices issued', String(s.invoicesIssued)],
    ['Outstanding AR', String(s.invoiceOutstandingAmount)],
    [],
    ['Site', 'Incidents', 'Clock-ins', 'Access', 'Visitors', 'Parking'],
    ...report.bySite.map((r) => [
      r.siteCode,
      String(r.incidentsOpened),
      String(r.attendanceClockIns),
      String(r.accessEntries),
      String(r.visitorGateEntries),
      String(r.parkingEntries),
    ]),
  ];
  const csv = lines
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.code}-report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CustomerReportPanel({ customerId }: { customerId: string }) {
  const [report, setReport] = useState<CustomerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getCustomerReport(customerId));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 border-t border-[#edebe9] pt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Reports (30d)
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0078d4] hover:underline"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {report ? (
            <button
              type="button"
              onClick={() => downloadCsv(report)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0078d4] hover:underline"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          ) : null}
        </div>
      </div>
      {loading && !report ? (
        <p className="text-xs text-[#605e5c]">Loading report…</p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {report ? (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {(
            [
              ['Incidents', report.summary.incidentsOpened],
              ['Clock-ins', report.summary.attendanceClockIns],
              ['Access', report.summary.accessEntries],
              ['Visitors', report.summary.visitorAppointments],
              ['Parking', report.summary.parkingEntries],
              ['Complaints', report.summary.complaintsOpened],
              ['Tickets', report.summary.serviceRequestsOpened],
              ['Invoices', report.summary.invoicesIssued],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-2.5 py-2"
            >
              <dt className="text-[10px] font-semibold uppercase text-[#8a8886]">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-[#323130]">
                {value}
              </dd>
            </div>
          ))}
          <div className="col-span-2 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-2.5 py-2">
            <dt className="text-[10px] font-semibold uppercase text-[#8a8886]">
              Outstanding AR
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-[#323130]">
              {money(
                report.summary.invoiceOutstandingAmount,
                report.summary.currency,
              )}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
