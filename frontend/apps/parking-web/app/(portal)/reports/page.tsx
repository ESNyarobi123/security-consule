'use client';

import {
  getParkingReport,
  listParkingSiteOptions,
  type ParkingOpsReport,
  type ParkingSiteOption,
} from '@pssms/api-client';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Panel } from '../_components/parking-ui';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function money(n: number, currency = 'TZS') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function downloadCsv(report: ParkingOpsReport) {
  const lines = [
    ['Metric', 'Value'],
    ['Period from', report.period.from],
    ['Period to', report.period.to],
    ['Sites in scope', String(report.summary.sitesInScope)],
    ['Registered vehicles', String(report.summary.registeredVehicles)],
    ['Active permits', String(report.summary.activePermits)],
    ['Entries', String(report.entriesExits.entries)],
    ['Exits', String(report.entriesExits.exits)],
    ['Denied', String(report.entriesExits.denied)],
    ['Open visits', String(report.entriesExits.openVisits)],
    ['Spaces total', String(report.occupancy.totalSpaces)],
    ['Spaces occupied', String(report.occupancy.occupied)],
    ['Utilization %', String(report.occupancy.utilizationPercent)],
    ['Violations in period', String(report.violations.recordedInPeriod)],
    ['Violations open', String(report.violations.openNow)],
    ['Blacklist active', String(report.blacklist.activePlates)],
    ['Patrol observations', String(report.patrols.observationsInPeriod)],
    [
      'Revenue billed',
      `${report.revenue.totalBilledInPeriod} ${report.revenue.currency}`,
    ],
    ['Security incidents', String(report.securityIncidents.incidentsInPeriod)],
    [],
    [
      'Site',
      'Entries',
      'Exits',
      'Denied',
      'Permits',
      'Violations',
      'Spaces',
      'Occupied',
      'Util %',
    ],
    ...report.bySite.map((r) => [
      `${r.siteCode} · ${r.siteName}`,
      String(r.entries),
      String(r.exits),
      String(r.denied),
      String(r.activePermits),
      String(r.violations),
      String(r.spacesTotal),
      String(r.spacesOccupied),
      String(r.utilizationPercent),
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
  a.download = `parking-report-${toLocalInput(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fieldCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15';

export default function ParkingReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalInput(d);
  });
  const [to, setTo] = useState(() => toLocalInput(new Date()));
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [report, setReport] = useState<ParkingOpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        getParkingReport({
          from: new Date(from).toISOString(),
          to: new Date(`${to}T23:59:59`).toISOString(),
          siteId: siteId || undefined,
        }),
        listParkingSiteOptions().catch(() => [] as ParkingSiteOption[]),
      ]);
      setReport(r);
      setSites(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const violationTypes = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.violations.byType).sort(
      (a, b) => b[1] - a[1],
    );
  }, [report]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Module 13-Q · Reports
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Parking reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live counts for entries, occupancy, violations, patrols, revenue, and
            security incidents — RBAC + site scope enforced.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report ? (
            <button
              type="button"
              onClick={() => downloadCsv(report)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 ${fieldCls}`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 ${fieldCls}`}
          />
        </label>
        <label className="block min-w-[180px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Site
          </span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={`mt-1 w-full ${fieldCls}`}
          >
            <option value="">All scoped sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8]"
        >
          Apply
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading && !report ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading report…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Entries" value={report.entriesExits.entries} />
            <Stat label="Exits" value={report.entriesExits.exits} />
            <Stat
              label="Utilization"
              value={`${report.occupancy.utilizationPercent}%`}
              hint={`${report.occupancy.occupied}/${report.occupancy.totalSpaces} bays`}
            />
            <Stat
              label="Revenue billed"
              value={money(
                report.revenue.totalBilledInPeriod,
                report.revenue.currency,
              )}
              hint="Permits + violation fines"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Entry & exit">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row k="Allowed" v={report.entriesExits.allowed} />
                <Row k="Denied" v={report.entriesExits.denied} />
                <Row k="Open visits" v={report.entriesExits.openVisits} />
                <Row k="Visitor entries" v={report.visitorParking.visitorEntries} />
              </dl>
            </Panel>
            <Panel title="Occupancy & spaces">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row k="Available" v={report.occupancy.available} />
                <Row k="Occupied" v={report.occupancy.occupied} />
                <Row k="Reserved" v={report.occupancy.reserved} />
                <Row k="Out of service" v={report.occupancy.outOfService} />
              </dl>
            </Panel>
            <Panel title="Visitor & employee parking">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row
                  k="Visitor permits"
                  v={report.visitorParking.activeVisitorPermits}
                />
                <Row
                  k="Contractor permits"
                  v={report.visitorParking.activeContractorPermits}
                />
                <Row
                  k="Employee permits"
                  v={report.employeeParking.activeEmployeePermits}
                />
                <Row
                  k="Customer employee vehicles"
                  v={report.employeeParking.customerEmployeeVehicles}
                />
                <Row k="Fleet vehicles" v={report.employeeParking.fleetVehicles} />
              </dl>
            </Panel>
            <Panel title="Violations & blacklist">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row k="Recorded" v={report.violations.recordedInPeriod} />
                <Row k="Open now" v={report.violations.openNow} />
                <Row k="Closed in period" v={report.violations.closedInPeriod} />
                <Row k="Fines billed" v={report.violations.finesBilledInPeriod} />
                <Row
                  k="Blacklist active"
                  v={report.blacklist.activePlates}
                />
                <Row k="Blacklist added" v={report.blacklist.addedInPeriod} />
              </dl>
              {violationTypes.length ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {violationTypes.map(([t, n]) => (
                    <li key={t}>
                      {t.replace(/_/g, ' ')} · {n}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
            <Panel title="Patrols">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row k="Observations" v={report.patrols.observationsInPeriod} />
                <Row k="High severity" v={report.patrols.highSeverity} />
                <Row k="Accidents" v={report.patrols.accidents} />
                <Row k="Suspicious" v={report.patrols.suspiciousActivity} />
                <Row k="Illegal parking" v={report.patrols.illegalParking} />
              </dl>
            </Panel>
            <Panel title="Revenue & security">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row
                  k="Permit invoices"
                  v={report.revenue.permitInvoicesBilledInPeriod}
                />
                <Row
                  k="Permit revenue"
                  v={money(
                    report.revenue.permitRevenueBilled,
                    report.revenue.currency,
                  )}
                />
                <Row
                  k="Violation invoices"
                  v={report.revenue.violationInvoicesBilledInPeriod}
                />
                <Row
                  k="Fine revenue"
                  v={money(
                    report.revenue.violationRevenueBilled,
                    report.revenue.currency,
                  )}
                />
                <Row
                  k="Incidents (parking sites)"
                  v={report.securityIncidents.incidentsInPeriod}
                />
                <Row
                  k="Incidents open"
                  v={report.securityIncidents.incidentsOpenNow}
                />
              </dl>
            </Panel>
          </div>

          <Panel title="By site">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Site</th>
                    <th className="px-2 py-2">In</th>
                    <th className="px-2 py-2">Out</th>
                    <th className="px-2 py-2">Deny</th>
                    <th className="px-2 py-2">Permits</th>
                    <th className="px-2 py-2">Violations</th>
                    <th className="px-2 py-2">Util %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySite.map((r) => (
                    <tr key={r.siteId} className="border-t border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-800">
                        {r.siteCode} · {r.siteName}
                      </td>
                      <td className="px-2 py-2">{r.entries}</td>
                      <td className="px-2 py-2">{r.exits}</td>
                      <td className="px-2 py-2">{r.denied}</td>
                      <td className="px-2 py-2">{r.activePermits}</td>
                      <td className="px-2 py-2">{r.violations}</td>
                      <td className="px-2 py-2">{r.utilizationPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <ul className="space-y-1 text-[11px] text-slate-400">
            {report.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
