'use client';

import {
  getCustomerPortalReport,
  type CustomerPortalReport,
} from '@pssms/api-client';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  formatDate,
  money,
} from '../../_components/portal-ui';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadCsv(report: CustomerPortalReport) {
  const s = report.summary;
  const ea = report.customerEmployeeAttendance;
  const p = report.parkingReport;
  const pay = report.payrollReport;
  const sla = report.slaPerformance;
  const lines = [
    ['Metric', 'Value'],
    ['Customer', `${report.code} · ${report.name}`],
    ['Period from', report.period.from],
    ['Period to', report.period.to],
    ['Sites', String(s.sites)],
    ['Active guards', String(s.activeGuards)],
    ['Incidents opened', String(s.incidentsOpened)],
    ['Incidents still open', String(s.incidentsStillOpen)],
    ['Attendance clock-ins', String(s.attendanceClockIns)],
    ['Access entries', String(s.accessEntries)],
    ['Visitor appointments', String(s.visitorAppointments)],
    ['Visitor gate entries', String(s.visitorGateEntries)],
    ['Parking entries', String(s.parkingEntries)],
    ['Complaints opened', String(s.complaintsOpened)],
    ['Complaints still open', String(s.complaintsStillOpen)],
    ['Service requests opened', String(s.serviceRequestsOpened)],
    ['Invoices issued', String(s.invoicesIssued)],
    ['Invoice outstanding', String(s.invoiceOutstandingAmount)],
    ['Currency', s.currency],
    [],
    ['Employee attendance', ''],
    ['Total employees', String(ea.totalEmployees)],
    ['Active employees', String(ea.activeEmployees)],
    ['Check-ins', String(ea.checkIns)],
    ['Check-outs', String(ea.checkOuts)],
    ['Unique employees seen', String(ea.uniqueEmployeesSeen)],
    [],
    ['Parking', ''],
    ['Registered vehicles', String(p.registeredVehicles)],
    ['Active permits', String(p.activePermits)],
    ['Pending permits', String(p.pendingPermits)],
    ['Entries', String(p.entries)],
    ['Exits', String(p.exits)],
    ['Denied entries', String(p.deniedEntries)],
    ['Violations', String(p.violations)],
    ['Blacklisted vehicles', String(p.blacklistedVehicles)],
    [],
    ['Payroll (customer-managed)', ''],
    ['Available', String(pay.available)],
    ['Cycles in period', String(pay.cyclesInPeriod)],
    ['Paid cycles', String(pay.paidCycles)],
    ['Pending cycles', String(pay.pendingCycles)],
    ['Latest cycle', pay.latestCycleCode ?? ''],
    ['Latest status', pay.latestCycleStatus ?? ''],
    ['Gross latest', String(pay.grossPayInLatestCycle)],
    ['Net latest', String(pay.netPayInLatestCycle)],
    ...(sla
      ? [
          [] as string[],
          ['SLA performance (live vs contract)', ''],
          ['Active contracts', String(sla.activeContracts)],
          ['Expiring contracts', String(sla.expiringContracts)],
          ['Contracts with SLA terms', String(sla.contractsWithSlaTerms)],
          ['SLA levels', sla.slaLevels.join('; ')],
          ['Committed guards', String(sla.committedGuards)],
          ['Deployed guards', String(sla.deployedGuards)],
        ]
      : []),
    [],
    [
      'Site code',
      'Site name',
      'Incidents',
      'Clock-ins',
      'Access',
      'Visitor gates',
      'Parking',
    ],
    ...report.bySite.map((r) => [
      r.siteCode,
      r.siteName,
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

export default function ReportsPage() {
  const defaults = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: toLocalInput(from), to: toLocalInput(to) };
  }, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [report, setReport] = useState<CustomerPortalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomerPortalReport({
        from: new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: new Date(`${to}T23:59:59.999Z`).toISOString(),
      });
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = report?.summary;

  return (
    <div className="space-y-6">
      <PortalHero
        eyebrow="Module 6 · Reports"
        title="Operational reports"
        subtitle="Live period counts for your organisation only — contracts, guards, attendance, employee access, visitors, parking, payroll, complaints, and billing."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {report ? (
              <button
                type="button"
                onClick={() => downloadCsv(report)}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0b1f3a] hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-[#323130]">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-[#323130]">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-[#e1dfdd] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#106ebe]"
        >
          Apply
        </button>
      </div>

      {error ? <PortalError message={error} /> : null}

      {loading && !report ? (
        <p className="text-sm text-[#605e5c]">Loading report…</p>
      ) : !report ? (
        <PortalEmpty title="No report data" description="Try another period." />
      ) : (
        <>
          <p className="text-xs text-[#8a8886]">
            {formatDate(report.period.from)} → {formatDate(report.period.to)} ·
            generated {formatDate(report.generatedAt)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PortalStat label="Sites" value={s!.sites} tone="sky" />
            <PortalStat label="Active guards" value={s!.activeGuards} tone="teal" />
            <PortalStat
              label="Incidents (period)"
              value={s!.incidentsOpened}
              tone="amber"
              hint={`${s!.incidentsStillOpen} still open`}
            />
            <PortalStat
              label="Clock-ins"
              value={s!.attendanceClockIns}
              tone="emerald"
            />
            <PortalStat label="Access entries" value={s!.accessEntries} />
            <PortalStat
              label="Visitor appointments"
              value={s!.visitorAppointments}
              hint={`${s!.visitorGateEntries} gate entries`}
            />
            <PortalStat label="Parking entries" value={s!.parkingEntries} />
            <PortalStat
              label="Complaints"
              value={s!.complaintsOpened}
              tone="rose"
              hint={`${s!.complaintsStillOpen} still open`}
            />
            <PortalStat
              label="Service requests"
              value={s!.serviceRequestsOpened}
              tone="violet"
            />
            <PortalStat
              label="Invoices issued"
              value={s!.invoicesIssued}
              hint={`AR ${money(s!.invoiceOutstandingAmount, s!.currency)}`}
            />
          </div>

          <PortalPanel title="Customer employee attendance">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <PortalStat
                label="Employees"
                value={report.customerEmployeeAttendance.totalEmployees}
                hint={`${report.customerEmployeeAttendance.activeEmployees} active`}
              />
              <PortalStat
                label="Check-ins"
                value={report.customerEmployeeAttendance.checkIns}
                tone="teal"
              />
              <PortalStat
                label="Check-outs"
                value={report.customerEmployeeAttendance.checkOuts}
                tone="sky"
              />
              <PortalStat
                label="Seen in period"
                value={report.customerEmployeeAttendance.uniqueEmployeesSeen}
                tone="violet"
              />
            </div>
          </PortalPanel>

          <PortalPanel title="Parking reports">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PortalStat
                label="Vehicles"
                value={report.parkingReport.registeredVehicles}
              />
              <PortalStat
                label="Active permits"
                value={report.parkingReport.activePermits}
                hint={`${report.parkingReport.pendingPermits} pending`}
                tone="teal"
              />
              <PortalStat
                label="Entries / exits"
                value={`${report.parkingReport.entries} / ${report.parkingReport.exits}`}
                hint={`${report.parkingReport.deniedEntries} denied`}
              />
              <PortalStat
                label="Violations"
                value={report.parkingReport.violations}
                hint={`${report.parkingReport.blacklistedVehicles} blacklisted`}
                tone="amber"
              />
            </div>
          </PortalPanel>

          <PortalPanel title="Payroll reports">
            {report.payrollReport.available ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PortalStat
                  label="Cycles in period"
                  value={report.payrollReport.cyclesInPeriod}
                  hint={`${report.payrollReport.paidCycles} paid · ${report.payrollReport.pendingCycles} pending`}
                />
                <PortalStat
                  label="Latest cycle"
                  value={report.payrollReport.latestCycleCode ?? '—'}
                  hint={report.payrollReport.latestCycleStatus ?? undefined}
                  tone="sky"
                />
                <PortalStat
                  label="Gross (latest)"
                  value={money(
                    report.payrollReport.grossPayInLatestCycle,
                    s!.currency,
                  )}
                />
                <PortalStat
                  label="Net (latest)"
                  value={money(
                    report.payrollReport.netPayInLatestCycle,
                    s!.currency,
                  )}
                  tone="teal"
                  hint={`${report.payrollReport.payslipsInLatestCycle} payslips`}
                />
              </div>
            ) : (
              <p className="text-sm text-[#605e5c]">
                No customer-managed payroll cycle is linked to this organisation
                yet. Guard payroll stays inside HIGHLINK.
              </p>
            )}
          </PortalPanel>

          {report.slaPerformance ? (
            <PortalPanel title="SLA performance (live vs contract)">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PortalStat
                  label="Active contracts"
                  value={report.slaPerformance.activeContracts}
                  hint={`${report.slaPerformance.expiringContracts} expiring · ${report.slaPerformance.contractsWithSlaTerms} with SLA terms`}
                  tone="sky"
                />
                <PortalStat
                  label="Guards deployed"
                  value={report.slaPerformance.deployedGuards}
                  hint={`${report.slaPerformance.committedGuards} committed on ACTIVE/EXPIRING contracts`}
                  tone="teal"
                />
                <PortalStat
                  label="Incidents (period)"
                  value={report.slaPerformance.incidentsOpened}
                  hint={`${report.slaPerformance.incidentsStillOpen} still open`}
                  tone="amber"
                />
                <PortalStat
                  label="Complaints (period)"
                  value={report.slaPerformance.complaintsOpened}
                  hint={`${report.slaPerformance.complaintsStillOpen} still open`}
                  tone="rose"
                />
              </div>
              {report.slaPerformance.slaLevels.length > 0 ? (
                <p className="mt-3 text-xs text-[#605e5c]">
                  SLA levels:{' '}
                  {report.slaPerformance.slaLevels.join(', ')}
                </p>
              ) : null}
            </PortalPanel>
          ) : null}

          <PortalPanel title="By site">
            {report.bySite.length === 0 ? (
              <p className="text-sm text-[#605e5c]">No sites linked.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-[#605e5c]">
                    <tr>
                      <th className="px-2 py-2">Site</th>
                      <th className="px-2 py-2">Incidents</th>
                      <th className="px-2 py-2">Clock-ins</th>
                      <th className="px-2 py-2">Access</th>
                      <th className="px-2 py-2">Visitors</th>
                      <th className="px-2 py-2">Parking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bySite.map((row) => (
                      <tr key={row.siteId} className="border-t border-[#edebe9]">
                        <td className="px-2 py-2 font-medium text-[#323130]">
                          {row.siteCode}
                          <span className="block text-xs font-normal text-[#8a8886]">
                            {row.siteName}
                          </span>
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.incidentsOpened}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.attendanceClockIns}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.accessEntries}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.visitorGateEntries}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {row.parkingEntries}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PortalPanel>
        </>
      )}

      <PortalDeferral note="Charts, PDF pack, and percentile response-time SLA remain deferred. Counts are live from your organisation’s operational tables for the selected window — not synthetic scores." />
    </div>
  );
}
