'use client';

import {
  getCustomerMe,
  getCustomerPortalAttendanceSummary,
  getCustomerPortalDeployments,
  getCustomerPortalIncidents,
  getCustomerPortalReport,
  listCustomerAccessEmployees,
  listCustomerContracts,
  listCustomerInvoices,
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  listCustomerVisitors,
  type Contract,
  type CustomerPortalReport,
  type CustomerProfile,
  type Invoice,
  type PortalAttendanceSummary,
  type PortalDeployment,
  type PortalIncident,
  type VisitorAppointment,
} from '@pssms/api-client';
import {
  ArrowRight,
  Car,
  ClipboardList,
  FileText,
  FolderOpen,
  MessageSquareWarning,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

const MODULES = [
  { href: '/contracts', label: 'Contracts', desc: 'Agreements & fees', icon: FileText },
  { href: '/invoices', label: 'Invoices', desc: 'Billing status', icon: FileText },
  { href: '/guards', label: 'Guards', desc: 'Deployed officers', icon: Shield },
  { href: '/attendance', label: 'Attendance', desc: 'Site coverage', icon: ClipboardList },
  { href: '/visitors', label: 'Visitors', desc: 'Appointments', icon: Users },
  { href: '/access', label: 'Staff access', desc: 'Your employees', icon: Users },
  { href: '/parking', label: 'Parking', desc: 'Vehicles & permits', icon: Car },
  { href: '/incidents', label: 'Incidents', desc: 'Site events', icon: ShieldAlert },
  { href: '/complaints', label: 'Complaints', desc: 'Service complaints', icon: MessageSquareWarning },
  { href: '/requests', label: 'Requests', desc: 'Service tickets', icon: ClipboardList },
  { href: '/contacts', label: 'Contacts', desc: 'Directory', icon: Users },
  { href: '/documents', label: 'Documents', desc: 'Shared files', icon: FolderOpen },
  { href: '/sla', label: 'SLA', desc: 'Service levels', icon: FileText },
  { href: '/reports', label: 'Reports', desc: 'Period pack', icon: FileText },
] as const;

function monthStartYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const [me, setMe] = useState<CustomerProfile | null>(null);
  const [report, setReport] = useState<CustomerPortalReport | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [visitors, setVisitors] = useState<VisitorAppointment[]>([]);
  const [accessCount, setAccessCount] = useState(0);
  const [vehicles, setVehicles] = useState(0);
  const [permits, setPermits] = useState(0);
  const [deployments, setDeployments] = useState<PortalDeployment[]>([]);
  const [incidents, setIncidents] = useState<PortalIncident[]>([]);
  const [attendance, setAttendance] = useState<PortalAttendanceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opsWarning, setOpsWarning] = useState<string | null>(null);
  const [from, setFrom] = useState(monthStartYmd);
  const [to, setTo] = useState(todayYmd);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOpsWarning(null);
    try {
      const [profile, c, inv, vis, access, veh, perm, periodReport] =
        await Promise.all([
          getCustomerMe(),
          listCustomerContracts(),
          listCustomerInvoices(),
          listCustomerVisitors(),
          listCustomerAccessEmployees(),
          listCustomerParkingVehicles(),
          listCustomerParkingPermits(),
          getCustomerPortalReport({ from, to }),
        ]);
      setMe(profile);
      setContracts(c);
      setInvoices(inv);
      setVisitors(vis);
      setAccessCount(access.length);
      setVehicles(veh.length);
      setPermits(perm.length);
      setReport(periodReport);

      const ops = await Promise.allSettled([
        getCustomerPortalDeployments(),
        getCustomerPortalIncidents(),
        getCustomerPortalAttendanceSummary(),
      ]);
      const failed: string[] = [];
      if (ops[0].status === 'fulfilled') setDeployments(ops[0].value);
      else {
        setDeployments([]);
        failed.push('guards');
      }
      if (ops[1].status === 'fulfilled') setIncidents(ops[1].value);
      else {
        setIncidents([]);
        failed.push('incidents');
      }
      if (ops[2].status === 'fulfilled') setAttendance(ops[2].value);
      else {
        setAttendance([]);
        failed.push('attendance');
      }
      if (failed.length) {
        setOpsWarning(
          `Some live ops panels could not load (${failed.join(', ')}). Other data is still shown.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const openInvoices = useMemo(
    () =>
      invoices.filter((i) => {
        const s = i.status.toUpperCase();
        return (
          !s.includes('PAID') &&
          !s.includes('CLOSED') &&
          !s.includes('CANCEL') &&
          !s.includes('VOID')
        );
      }),
    [invoices],
  );

  const activeContracts = contracts.filter((c) =>
    c.status.toUpperCase().includes('ACTIVE'),
  ).length;

  const expiringContracts = useMemo(() => {
    const in90 = Date.now() + 90 * 24 * 60 * 60 * 1000;
    return contracts.filter((c) => {
      const s = c.status.toUpperCase();
      if (s.includes('EXPIR')) return true;
      if (!c.endDate) return false;
      const end = new Date(c.endDate).getTime();
      return (
        !Number.isNaN(end) &&
        end <= in90 &&
        end >= Date.now() &&
        s.includes('ACTIVE')
      );
    }).length;
  }, [contracts]);

  const pendingVisitors = useMemo(
    () =>
      visitors.filter((v) => {
        const s = v.status.toUpperCase();
        return (
          s.includes('PENDING') || s.includes('AWAIT') || s.includes('REQUEST')
        );
      }).length,
    [visitors],
  );

  const activeGuards = useMemo(
    () =>
      deployments.filter((d) => d.status.toUpperCase().includes('ACTIVE'))
        .length,
    [deployments],
  );

  const openIncidentsLive = useMemo(
    () =>
      incidents.filter((i) => {
        const s = i.status.toUpperCase();
        return s === 'OPEN' || s === 'INVESTIGATING';
      }).length,
    [incidents],
  );

  const clockedIn = useMemo(
    () => attendance.reduce((n, a) => n + (a.clockedInToday ?? 0), 0),
    [attendance],
  );

  const summary = report?.summary;
  const employeeAttendance = report?.customerEmployeeAttendance;
  const parkingReport = report?.parkingReport;
  const payrollReport = report?.payrollReport;
  const openIncidents = summary?.incidentsStillOpen ?? openIncidentsLive;
  const outstanding =
    summary?.invoiceOutstandingAmount ??
    openInvoices.reduce(
      (sum, i) =>
        sum + Math.max(0, Number(i.totalAmount ?? 0) - Number(i.amountPaid ?? 0)),
      0,
    );

  const recentVisitors = visitors.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);
  const recentIncidents = incidents.slice(0, 5);
  const recentGuards = deployments
    .filter((d) => d.status.toUpperCase().includes('ACTIVE'))
    .slice(0, 5);
  const topSites = (report?.bySite ?? [])
    .slice()
    .sort(
      (a, b) =>
        b.incidentsOpened +
        b.attendanceClockIns +
        b.accessEntries -
        (a.incidentsOpened + a.attendanceClockIns + a.accessEntries),
    )
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="w-full space-y-5">
      <PortalHero
        eyebrow="Overview · Portal 35.8"
        title={`${greeting}${me ? `, ${me.name.split(' ')[0]}` : ''}`}
        subtitle={
          me
            ? `${me.name} (${me.code}) — your HIGHLINK services, own organisation only.`
            : 'Your organisation overview — scoped to your customer account.'
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3.5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Period bar — Module 6-C report window */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
        <div className="mr-auto min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Reporting period
          </p>
          <p className="text-base font-medium text-slate-800">
            Counts for complaints, attendance, access, parking, and billing
          </p>
        </div>
        <label className="text-sm font-medium text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20"
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-[#0078d4] px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-[#106ebe]"
        >
          Apply
        </button>
      </div>

      {error ? <PortalError message={error} /> : null}
      {opsWarning ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900"
        >
          {opsWarning}
        </div>
      ) : null}

      {/* Commercial + ops snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
        <PortalStat
          label="Active contracts"
          value={loading ? '—' : activeContracts}
          hint={
            expiringContracts > 0
              ? `${expiringContracts} expiring ≤90d`
              : `${contracts.length} total`
          }
          href="/contracts"
          tone="teal"
        />
        <PortalStat
          label="Guards on site"
          value={loading ? '—' : (summary?.activeGuards ?? activeGuards)}
          hint={
            clockedIn > 0
              ? `${clockedIn} clocked in today`
              : `${deployments.length} deployments`
          }
          href="/guards"
          tone="sky"
        />
        <PortalStat
          label="Open invoices"
          value={loading ? '—' : openInvoices.length}
          hint={
            outstanding > 0
              ? `${money(outstanding, summary?.currency ?? 'TZS')} outstanding`
              : 'Nothing overdue'
          }
          href="/invoices"
          tone="amber"
        />
        <PortalStat
          label="Open incidents"
          value={loading ? '—' : openIncidents}
          hint={
            summary
              ? `${summary.incidentsOpened} opened in period`
              : `${incidents.length} total on your sites`
          }
          href="/incidents"
          tone="rose"
        />
      </div>

      {/* Attention + ops (from report pack where possible) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat
          label="Open complaints"
          value={loading ? '—' : (summary?.complaintsStillOpen ?? '—')}
          hint={
            summary
              ? `${summary.complaintsOpened} opened in period`
              : 'From period report'
          }
          href="/complaints"
          tone="rose"
        />
        <PortalStat
          label="Service requests"
          value={loading ? '—' : (summary?.serviceRequestsOpened ?? '—')}
          hint="Opened in selected period"
          href="/requests"
          tone="violet"
        />
        <PortalStat
          label="Visitors pending"
          value={loading ? '—' : pendingVisitors}
          hint={
            summary
              ? `${summary.visitorAppointments} appointments in period`
              : `${visitors.length} appointments`
          }
          href="/visitors"
          tone="violet"
        />
        <PortalStat
          label="Parking"
          value={loading ? '—' : vehicles}
          hint={
            summary
              ? `${summary.parkingEntries} entries · ${permits} permits`
              : `${permits} permits`
          }
          href="/parking"
          tone="sky"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat
          label="Customer employees"
          value={loading ? '—' : (employeeAttendance?.activeEmployees ?? accessCount)}
          hint={
            employeeAttendance
              ? `${employeeAttendance.uniqueEmployeesSeen} seen in period`
              : 'Your employees only'
          }
          href="/access"
          tone="emerald"
        />
        <PortalStat
          label="Employee attendance"
          value={loading ? '—' : (employeeAttendance?.checkIns ?? summary?.accessEntries ?? '—')}
          hint={
            employeeAttendance
              ? `${employeeAttendance.checkOuts} check-outs in period`
              : 'Access punches in period'
          }
          href="/access"
          tone="teal"
        />
        <PortalStat
          label="Parking reports"
          value={loading ? '—' : (parkingReport?.entries ?? vehicles)}
          hint={
            parkingReport
              ? `${parkingReport.violations} violations · ${parkingReport.activePermits} active permits`
              : `${permits} permits`
          }
          href="/parking"
          tone="sky"
        />
        <PortalStat
          label="Payroll reports"
          value={loading ? '—' : (payrollReport?.cyclesInPeriod ?? '—')}
          hint={
            payrollReport?.available
              ? `${money(payrollReport.netPayInLatestCycle, summary?.currency ?? 'TZS')} latest net`
              : 'No customer payroll cycle yet'
          }
          href="/reports"
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PortalPanel
          title="Customer employee attendance"
          action={
            <Link
              href="/access"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
            >
              Open access <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          {loading ? (
            <p className="text-base text-slate-500">Loading…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Total employees</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {employeeAttendance?.totalEmployees ?? accessCount}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Unique seen</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {employeeAttendance?.uniqueEmployeesSeen ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Check-ins</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {employeeAttendance?.checkIns ?? summary?.accessEntries ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Check-outs</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {employeeAttendance?.checkOuts ?? 0}
                </dd>
              </div>
            </dl>
          )}
        </PortalPanel>

        <PortalPanel
          title="Parking report"
          action={
            <Link
              href="/parking"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
            >
              Open parking <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          {loading ? (
            <p className="text-base text-slate-500">Loading…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Registered vehicles</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {parkingReport?.registeredVehicles ?? vehicles}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Active permits</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {parkingReport?.activePermits ?? permits}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Entries / exits</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {(parkingReport?.entries ?? 0)}/{parkingReport?.exits ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Violations</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {parkingReport?.violations ?? 0}
                </dd>
              </div>
            </dl>
          )}
        </PortalPanel>

        <PortalPanel
          title="Payroll report"
          action={
            <Link
              href="/payroll"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
            >
              Employee payroll <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          {loading ? (
            <p className="text-base text-slate-500">Loading…</p>
          ) : payrollReport?.available ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Cycles in period</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {payrollReport.cyclesInPeriod}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Latest cycle</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">
                  {payrollReport.latestCycleCode ?? '—'}
                </dd>
                <p className="mt-1 text-xs text-slate-500">
                  {payrollReport.latestCycleStatus ?? 'Unknown status'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Latest gross</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {money(payrollReport.grossPayInLatestCycle, summary?.currency ?? 'TZS')}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-500">Latest net</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-900">
                  {money(payrollReport.netPayInLatestCycle, summary?.currency ?? 'TZS')}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No customer-managed payroll cycle is linked to this customer yet.
            </div>
          )}
        </PortalPanel>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0078d4] hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0078d4] ring-1 ring-sky-100 transition group-hover:bg-[#0078d4] group-hover:text-white group-hover:ring-[#0078d4]">
                <m.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-slate-900">
                  {m.label}
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">
                  {m.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PortalPanel
            title="Recent invoices"
            action={
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-base text-slate-500">Loading…</p>
            ) : recentInvoices.length === 0 ? (
              <p className="text-base text-slate-500">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 py-3 text-base"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {inv.invoiceNumber ?? inv.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-slate-500">
                        Due {formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {money(inv.totalAmount ?? 0, inv.currency ?? 'TZS')}
                      </p>
                      <div className="mt-0.5 flex justify-end">
                        <StatusPill status={inv.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>

          <div className="grid gap-4 md:grid-cols-2">
            <PortalPanel
              title="Recent visitors"
              action={
                <Link
                  href="/visitors"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              {loading ? (
                <p className="text-base text-slate-500">Loading…</p>
              ) : recentVisitors.length === 0 ? (
                <p className="text-base text-slate-500">No visitor appointments.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentVisitors.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 py-3 text-base"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {v.visitorName ?? 'Visitor'}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {v.purpose ?? v.referenceNumber ?? '—'}
                        </p>
                      </div>
                      <StatusPill status={v.status} />
                    </li>
                  ))}
                </ul>
              )}
            </PortalPanel>

            <PortalPanel
              title="Site incidents"
              action={
                <Link
                  href="/incidents"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              }
            >
              {loading ? (
                <p className="text-base text-slate-500">Loading…</p>
              ) : recentIncidents.length === 0 ? (
                <p className="text-base text-slate-500">No incidents on your sites.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentIncidents.map((inc) => (
                    <li
                      key={inc.id}
                      className="flex items-center justify-between gap-3 py-3 text-base"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {inc.incidentNumber} · {inc.title}
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {inc.siteName ?? inc.siteCode ?? 'Site'} ·{' '}
                          {inc.severity}
                        </p>
                      </div>
                      <StatusPill status={inc.status} />
                    </li>
                  ))}
                </ul>
              )}
            </PortalPanel>
          </div>
        </div>

        <div className="space-y-4">
          <PortalPanel
            title="Guards on your sites"
            action={
              <Link
                href="/guards"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
              >
                Roster <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-base text-slate-500">Loading…</p>
            ) : recentGuards.length === 0 ? (
              <p className="text-base text-slate-500">No active deployments.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentGuards.map((d) => (
                  <li key={d.id} className="py-3 text-base">
                    <p className="font-semibold text-slate-900">
                      {d.guard.fullName ?? d.guard.guardNumber}
                    </p>
                    <p className="text-sm text-slate-500">
                      {d.guard.guardNumber} · {d.site.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>

          <PortalPanel
            title="Sites in period"
            action={
              <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0078d4] hover:underline"
              >
                Full report <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-base text-slate-500">Loading…</p>
            ) : topSites.length === 0 ? (
              <p className="text-base text-slate-500">No site activity in period.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {topSites.map((s) => (
                  <li key={s.siteId} className="py-3 text-base">
                    <p className="font-semibold text-slate-900">{s.siteName}</p>
                    <p className="text-sm text-slate-500">
                      {s.siteCode} · {s.incidentsOpened} incidents ·{' '}
                      {s.attendanceClockIns} clock-ins
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>

          <PortalPanel title="Your profile">
            {me ? (
              <dl className="space-y-2 text-base">
                <div>
                  <dt className="text-sm text-slate-500">Organisation</dt>
                  <dd className="font-semibold text-slate-900">{me.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Code</dt>
                  <dd className="font-mono text-slate-800">{me.code}</dd>
                </div>
                {report ? (
                  <div>
                    <dt className="text-sm text-slate-500">Report generated</dt>
                    <dd className="text-slate-700">
                      {formatDate(report.generatedAt)}
                    </dd>
                  </div>
                ) : null}
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-[#0078d4] hover:underline"
                >
                  Open profile <ArrowRight className="h-4 w-4" />
                </Link>
              </dl>
            ) : (
              <p className="text-base text-slate-500">Loading…</p>
            )}
          </PortalPanel>
        </div>
      </div>

      {report?.notes?.length ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          {report.notes.join(' · ')}
        </p>
      ) : null}

      <PortalDeferral note="Overview uses Module 6-C period report + live lists (own org only). SLA analytics, notifications inbox, and SSE deferred." />
    </div>
  );
}
