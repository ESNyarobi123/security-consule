'use client';

import {
  getBranchOpsReport,
  listSites,
  type BranchOpsReport,
  type Site,
} from '@pssms/api-client';
import { GlassCard, btnSecondary } from '@pssms/ui';
import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError } from '../_components/shared';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadCsv(report: BranchOpsReport) {
  const lines = [
    ['Metric', 'Value'],
    ['Period from', report.period.from],
    ['Period to', report.period.to],
    ['Sites in scope', String(report.summary.sitesInScope)],
    ['Active deployments', String(report.summary.activeDeployments)],
    ['Open punches now', String(report.summary.openPunchesNow)],
    ['Clock-ins', String(report.attendance.clockInsInPeriod)],
    ['Supervisor approved', String(report.attendance.supervisorApprovedInPeriod)],
    ['Alertness missed', String(report.alertness.missed)],
    ['Alertness confirmation %', String(report.alertness.confirmationRatePercent)],
    ['Field alerts raised', String(report.fieldAlerts.raisedInPeriod)],
    ['Field alerts open', String(report.fieldAlerts.openNow)],
    ['Patrol scans', String(report.patrols.scansInPeriod)],
    ['Patrol issues', String(report.patrols.patrolIssuesInPeriod)],
    ['Incidents opened', String(report.incidents.openedInPeriod)],
    ['Incidents open', String(report.incidents.openNow)],
    ['EOB entries', String(report.eob.entriesInPeriod)],
    ['Visitor gate allowed', String(report.visitors.gateAllowed)],
    ['Visitor gate denied', String(report.visitors.gateDenied)],
    ['CCTV open backlog', String(report.cctv.openAlertsNow)],
    [],
    [
      'Site',
      'Clock-ins',
      'Alertness missed',
      'Field alerts',
      'Patrol scans',
      'Incidents',
      'EOB',
      'Visitor denied',
    ],
    ...report.bySite.map((r) => [
      `${r.siteCode} · ${r.siteName}`,
      String(r.clockIns),
      String(r.alertnessMissed),
      String(r.fieldAlerts),
      String(r.patrolScans),
      String(r.incidentsOpened),
      String(r.eobEntries),
      String(r.visitorDenied),
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
  a.download = `branch-ops-report-${toLocalInput(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fieldCls =
  'rounded-md border border-[#e1dfdd] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/15';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#e1dfdd] bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#605e5c]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1b1a19]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-[#605e5c]">{hint}</p>
      ) : null}
    </div>
  );
}

export default function BranchReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalInput(d);
  });
  const [to, setTo] = useState(() => toLocalInput(new Date()));
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [report, setReport] = useState<BranchOpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        getBranchOpsReport({
          from: new Date(from).toISOString(),
          to: new Date(`${to}T23:59:59`).toISOString(),
          siteId: siteId || undefined,
        }),
        listSites().catch(() => [] as Site[]),
      ]);
      setReport(r);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const topFieldAlerts = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.fieldAlerts.byType).sort(
      (a, b) => b[1] - a[1],
    );
  }, [report]);

  return (
    <BranchShell
      title="Field ops reports"
      description="Live period pack for attendance, alertness, patrols, incidents, gate verification, and CCTV metadata — site ABAC enforced."
      actions={
        <>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1.5 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          {report ? (
            <button
              type="button"
              className={btnSecondary}
              onClick={() => downloadCsv(report)}
            >
              <Download className="mr-1.5 inline h-4 w-4" />
              CSV
            </button>
          ) : null}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#605e5c]">
          From
          <input
            type="date"
            className={fieldCls}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#605e5c]">
          To
          <input
            type="date"
            className={fieldCls}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex min-w-[200px] flex-col gap-1 text-xs text-[#605e5c]">
          Site
          <select
            className={fieldCls}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">All sites in scope</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <GlassCard className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </GlassCard>
      ) : null}

      {loading && !report ? (
        <p className="text-sm text-[#605e5c]">Loading report…</p>
      ) : null}

      {report ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Sites in scope"
              value={report.summary.sitesInScope}
            />
            <StatCard
              label="Active deployments"
              value={report.summary.activeDeployments}
              hint="Current"
            />
            <StatCard
              label="Open punches"
              value={report.summary.openPunchesNow}
              hint="Current"
            />
            <StatCard
              label="Field alerts open"
              value={report.fieldAlerts.openNow}
              hint="Current"
            />
          </div>

          <GlassCard className="p-4">
            <h2 className="text-sm font-semibold text-[#1b1a19]">
              Attendance & alertness
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Clock-ins"
                value={report.attendance.clockInsInPeriod}
              />
              <StatCard
                label="Supervisor approved"
                value={report.attendance.supervisorApprovedInPeriod}
              />
              <StatCard
                label="Alertness missed"
                value={report.alertness.missed}
              />
              <StatCard
                label="Confirmation rate"
                value={`${report.alertness.confirmationRatePercent}%`}
              />
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-4">
              <h2 className="text-sm font-semibold text-[#1b1a19]">
                Patrols & incidents
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Patrol scans"
                  value={report.patrols.scansInPeriod}
                />
                <StatCard
                  label="Patrol issues"
                  value={report.patrols.patrolIssuesInPeriod}
                />
                <StatCard
                  label="Incidents opened"
                  value={report.incidents.openedInPeriod}
                />
                <StatCard
                  label="Incidents open"
                  value={report.incidents.openNow}
                  hint={
                    report.incidents.criticalOpenNow > 0
                      ? `${report.incidents.criticalOpenNow} critical`
                      : undefined
                  }
                />
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h2 className="text-sm font-semibold text-[#1b1a19]">
                Gate & CCTV metadata
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Visitor allowed (IN)"
                  value={report.visitors.gateAllowed}
                />
                <StatCard
                  label="Visitor denied"
                  value={report.visitors.gateDenied}
                />
                <StatCard label="EOB entries" value={report.eob.entriesInPeriod} />
                <StatCard
                  label="CCTV open backlog"
                  value={report.cctv.openAlertsNow}
                  hint={`${report.cctv.triagedInPeriod} triaged in period`}
                />
              </div>
            </GlassCard>
          </div>

          {topFieldAlerts.length > 0 ? (
            <GlassCard className="p-4">
              <h2 className="text-sm font-semibold text-[#1b1a19]">
                Field alert types (period)
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-[#323130]">
                {topFieldAlerts.map(([type, count]) => (
                  <li key={type} className="flex justify-between gap-4">
                    <span className="font-mono text-xs">{type}</span>
                    <span className="tabular-nums font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ) : null}

          {report.bySite.length > 0 ? (
            <GlassCard className="overflow-x-auto p-4">
              <h2 className="text-sm font-semibold text-[#1b1a19]">By site</h2>
              <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e1dfdd] text-xs uppercase text-[#605e5c]">
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Clock-ins</th>
                    <th className="py-2 pr-3">Missed</th>
                    <th className="py-2 pr-3">Alerts</th>
                    <th className="py-2 pr-3">Scans</th>
                    <th className="py-2 pr-3">Incidents</th>
                    <th className="py-2 pr-3">EOB</th>
                    <th className="py-2">Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySite.map((row) => (
                    <tr
                      key={row.siteId}
                      className="border-b border-[#f3f2f1] last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {row.siteCode}
                        <span className="ml-1 text-xs font-normal text-[#605e5c]">
                          {row.siteName}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{row.clockIns}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.alertnessMissed}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.fieldAlerts}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.patrolScans}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.incidentsOpened}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.eobEntries}
                      </td>
                      <td className="py-2 tabular-nums">{row.visitorDenied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          ) : null}

          <GlassCard className="p-4 text-xs text-[#605e5c]">
            <p className="font-medium text-[#323130]">Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px]">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </GlassCard>
        </div>
      ) : null}
    </BranchShell>
  );
}
