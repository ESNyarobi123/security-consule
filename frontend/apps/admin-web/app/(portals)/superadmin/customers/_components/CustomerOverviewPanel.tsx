'use client';

import type { CustomerOverview } from '@pssms/api-client';
import Link from 'next/link';

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

function Chip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'warn' | 'ok';
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'ok'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-[#e1dfdd] bg-[#faf9f8] text-[#323130]';
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneCls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  title,
  href,
  children,
  empty,
}: {
  title: string;
  href?: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  const hasContent = Boolean(children);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          {title}
        </h3>
        {href ? (
          <Link
            href={href}
            className="text-[11px] font-semibold text-[#0078d4] hover:underline"
          >
            Open
          </Link>
        ) : null}
      </div>
      {hasContent ? (
        children
      ) : (
        <p className="mt-2 text-xs text-[#605e5c]">{empty ?? 'None yet.'}</p>
      )}
    </div>
  );
}

export function CustomerOverviewPanel({
  overview,
  loading,
  error,
}: {
  overview: CustomerOverview | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <p className="text-xs text-[#605e5c]">Loading 360 overview…</p>;
  }
  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {error}
      </p>
    );
  }
  if (!overview) return null;

  const c = overview.counts;
  const cur = overview.billing.currency;

  return (
    <div className="space-y-5 border-t border-[#edebe9] pt-5">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          Customer 360
        </h3>
        <p className="mt-1 text-[11px] text-[#8a8886]">
          Linked records for this customer (Module 6 thin overview).
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Chip label="Sites" value={c.sites} />
          <Chip label="Contracts" value={c.contracts} />
          <Chip label="Guards" value={c.activeGuards} tone="ok" />
          <Chip label="Employees" value={c.employees} />
          <Chip
            label="Open inv."
            value={c.openInvoices}
            tone={c.overdueInvoices ? 'warn' : 'neutral'}
          />
          <Chip
            label="Overdue"
            value={c.overdueInvoices}
            tone={c.overdueInvoices ? 'warn' : 'neutral'}
          />
          <Chip label="Incidents" value={c.openIncidents} tone={c.openIncidents ? 'warn' : 'neutral'} />
          <Chip label="Tickets" value={c.openServiceRequests} />
          <Chip
            label="Complaints"
            value={c.openComplaints}
            tone={c.openComplaints ? 'warn' : 'neutral'}
          />
          <Chip label="Vehicles" value={c.vehicles} />
          <Chip label="Permits" value={c.activePermits} />
          <Chip label="Access 30d" value={c.accessEntries30d} />
          <Chip label="Visits pend." value={c.pendingAppointments} />
        </div>
        <p className="mt-2 text-xs text-[#323130]">
          Outstanding{' '}
          <span className="font-semibold">
            {money(overview.billing.outstandingAmount, cur)}
          </span>
          {' · '}
          Paid{' '}
          <span className="font-semibold">
            {money(overview.billing.paidAmount, cur)}
          </span>
        </p>
      </div>

      <Section
        title={`Contracts (${overview.contracts.length})`}
        href={`/superadmin/contracts?customerId=${overview.customerId}`}
        empty="No contracts."
      >
        {overview.contracts.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.contracts.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {row.contractNumber}{' '}
                  <span className="font-normal text-[#605e5c]">
                    · {row.status}
                  </span>
                </p>
                <p className="text-[#605e5c]">
                  {row.serviceType} · {money(row.monthlyFee, row.currency)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Assigned guards (${overview.guards.length})`}
        href="/operations/guards"
        empty="No ACTIVE deployments at customer sites."
      >
        {overview.guards.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.guards.map((g) => (
              <li
                key={g.deploymentId}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {g.fullName ?? g.guardNumber}
                </p>
                <p className="text-[#605e5c]">
                  {g.guardNumber} · {g.siteCode} · {g.status}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Invoices (${overview.invoices.length})`}
        href="/finance"
        empty="No invoices."
      >
        {overview.invoices.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {inv.invoiceNumber}{' '}
                  <span className="font-normal text-[#605e5c]">
                    · {inv.status}
                  </span>
                </p>
                <p className="text-[#605e5c]">
                  Bal {money(inv.balance, inv.currency)} · due {inv.dueDate}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Incidents (${overview.incidents.length})`}
        href="/branch/incidents"
        empty="No incidents at customer sites."
      >
        {overview.incidents.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.incidents.map((inc) => (
              <li
                key={inc.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {inc.incidentNumber} · {inc.severity}
                </p>
                <p className="truncate text-[#605e5c]">
                  {inc.title} · {inc.status}
                  {inc.siteCode ? ` · ${inc.siteCode}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Service requests (${overview.serviceRequests.length})`}
        href="/callcentre"
        empty="No service tickets."
      >
        {overview.serviceRequests.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.serviceRequests.map((sr) => (
              <li
                key={sr.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {sr.referenceNumber} · {sr.status}
                </p>
                <p className="truncate text-[#605e5c]">
                  {sr.category} · {sr.title}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Complaints (${overview.complaints?.length ?? 0})`}
        href="/callcentre"
        empty="No complaints filed."
      >
        {overview.complaints?.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.complaints.map((cmp) => (
              <li
                key={cmp.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">
                  {cmp.referenceNumber} · {cmp.severity}
                </p>
                <p className="truncate text-[#605e5c]">
                  {cmp.status} · {cmp.title}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Customer employees (${overview.employees.length})`}
        empty="No customer employees registered."
      >
        {overview.employees.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.employees.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">{e.fullName}</p>
                <p className="text-[#605e5c]">
                  {e.employeeNumber ?? '—'}
                  {e.department ? ` · ${e.department}` : ''}
                  {e.isActive ? '' : ' · inactive'}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title={`Parking vehicles (${overview.vehicles.length})`}
        empty="No vehicles linked to this customer."
      >
        {overview.vehicles.length ? (
          <ul className="mt-2 space-y-1.5">
            {overview.vehicles.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"
              >
                <p className="font-semibold text-[#323130]">{v.plateNumber}</p>
                <p className="text-[#605e5c]">
                  {v.vehicleType}
                  {v.ownerName ? ` · ${v.ownerName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
