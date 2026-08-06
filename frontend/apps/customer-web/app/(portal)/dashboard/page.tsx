'use client';

import {
  getCustomerMe,
  getCustomerPortalAttendanceSummary,
  getCustomerPortalDeployments,
  getCustomerPortalIncidents,
  listCustomerAccessEmployees,
  listCustomerContracts,
  listCustomerInvoices,
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  listCustomerVisitors,
  type Contract,
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
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
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
  { href: '/sla', label: 'SLA', desc: 'Service levels', icon: FileText },
  { href: '/reports', label: 'Reports', desc: 'Ops & billing period pack', icon: FileText },
  { href: '/requests', label: 'Requests', desc: 'How to ask', icon: ClipboardList },
] as const;

export default function DashboardPage() {
  const [me, setMe] = useState<CustomerProfile | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOpsWarning(null);
    try {
      const [
        profile,
        c,
        inv,
        vis,
        access,
        veh,
        perm,
      ] = await Promise.all([
        getCustomerMe(),
        listCustomerContracts(),
        listCustomerInvoices(),
        listCustomerVisitors(),
        listCustomerAccessEmployees(),
        listCustomerParkingVehicles(),
        listCustomerParkingPermits(),
      ]);
      setMe(profile);
      setContracts(c);
      setInvoices(inv);
      setVisitors(vis);
      setAccessCount(access.length);
      setVehicles(veh.length);
      setPermits(perm.length);

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
  }, []);

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

  const overdueAmount = useMemo(() => {
    return openInvoices.reduce((sum, i) => {
      const total = Number(i.totalAmount ?? 0);
      const paid = Number(i.amountPaid ?? 0);
      const s = i.status.toUpperCase();
      const due = i.dueDate ? new Date(i.dueDate) : null;
      const isOverdue =
        s.includes('OVERDUE') ||
        (due &&
          !Number.isNaN(due.getTime()) &&
          due.getTime() < Date.now() &&
          total > paid);
      return isOverdue ? sum + Math.max(0, total - paid) : sum;
    }, 0);
  }, [openInvoices]);

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

  const openIncidents = useMemo(
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

  const recentVisitors = visitors.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);
  const recentIncidents = incidents.slice(0, 5);
  const recentGuards = deployments
    .filter((d) => d.status.toUpperCase().includes('ACTIVE'))
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Overview · Portal 35.8"
        title={`${greeting}${me ? `, ${me.name.split(' ')[0]}` : ''}`}
        subtitle={
          me
            ? `${me.name} (${me.code}) — live snapshot of your HIGHLINK security services.`
            : 'Your organisation overview — scoped to your customer account.'
        }
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
      {opsWarning ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {opsWarning}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          value={loading ? '—' : activeGuards}
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
            overdueAmount > 0
              ? `${money(overdueAmount)} outstanding`
              : 'Nothing overdue'
          }
          href="/invoices"
          tone="amber"
        />
        <PortalStat
          label="Open incidents"
          value={loading ? '—' : openIncidents}
          hint={`${incidents.length} total on your sites`}
          href="/incidents"
          tone="rose"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat
          label="Visitors pending"
          value={loading ? '—' : pendingVisitors}
          hint={`${visitors.length} appointments`}
          href="/visitors"
          tone="violet"
        />
        <PortalStat
          label="Staff on access"
          value={loading ? '—' : accessCount}
          hint="Your employees only"
          href="/access"
          tone="emerald"
        />
        <PortalStat
          label="Parking"
          value={loading ? '—' : vehicles}
          hint={`${permits} permits`}
          href="/parking"
          tone="sky"
        />
        <PortalStat
          label="Coverage today"
          value={loading ? '—' : `${clockedIn}/${activeGuards || '—'}`}
          hint="Clocked in / active posts"
          href="/attendance"
          tone="teal"
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#1b1a19]">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex items-start gap-3 rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0078d4] hover:shadow-md"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4] transition group-hover:bg-[#0078d4] group-hover:text-white">
                <m.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#1b1a19]">
                  {m.label}
                </span>
                <span className="mt-0.5 block text-xs text-[#605e5c]">
                  {m.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PortalPanel
            title="Recent invoices"
            action={
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-[#605e5c]">Loading…</p>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-[#605e5c]">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-[#edebe9]">
                {recentInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1b1a19]">
                        {inv.invoiceNumber ?? inv.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-[#605e5c]">
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
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {loading ? (
                <p className="text-sm text-[#605e5c]">Loading…</p>
              ) : recentVisitors.length === 0 ? (
                <p className="text-sm text-[#605e5c]">No visitor appointments.</p>
              ) : (
                <ul className="divide-y divide-[#edebe9]">
                  {recentVisitors.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#1b1a19]">
                          {v.visitorName ?? 'Visitor'}
                        </p>
                        <p className="truncate text-xs text-[#605e5c]">
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
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {loading ? (
                <p className="text-sm text-[#605e5c]">Loading…</p>
              ) : recentIncidents.length === 0 ? (
                <p className="text-sm text-[#605e5c]">No incidents on your sites.</p>
              ) : (
                <ul className="divide-y divide-[#edebe9]">
                  {recentIncidents.map((inc) => (
                    <li
                      key={inc.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#1b1a19]">
                          {inc.incidentNumber} · {inc.title}
                        </p>
                        <p className="truncate text-xs text-[#605e5c]">
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
              >
                Roster <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-[#605e5c]">Loading…</p>
            ) : recentGuards.length === 0 ? (
              <p className="text-sm text-[#605e5c]">No active deployments.</p>
            ) : (
              <ul className="divide-y divide-[#edebe9]">
                {recentGuards.map((d) => (
                  <li key={d.id} className="py-2.5 text-sm">
                    <p className="font-semibold text-[#1b1a19]">
                      {d.guard.fullName ?? d.guard.guardNumber}
                    </p>
                    <p className="text-xs text-[#605e5c]">
                      {d.guard.guardNumber} · {d.site.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>

          <PortalPanel title="Your profile">
            {me ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">
                    Company
                  </dt>
                  <dd className="font-semibold text-[#1b1a19]">{me.name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">Code</dt>
                  <dd className="font-mono text-[#323130]">{me.code}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">
                    Contact
                  </dt>
                  <dd className="text-[#323130]">{me.email ?? '—'}</dd>
                  <dd className="text-[#323130]">{me.phone ?? '—'}</dd>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold">
                    {me.isActive ? 'Account active' : 'Account inactive'}
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
                >
                  Full profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </dl>
            ) : (
              <p className="text-sm text-[#605e5c]">Loading profile…</p>
            )}
          </PortalPanel>
        </div>
      </div>

      <PortalDeferral note="Data is scoped to your organisation only. Guard biometrics, alertness detail, and other customers are never shown here." />
    </div>
  );
}
