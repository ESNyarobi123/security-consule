'use client';

import {
  getCustomerPortalIncidents,
  listCustomerInvoices,
  listCustomerVisitors,
  type Invoice,
  type PortalIncident,
  type VisitorAppointment,
} from '@pssms/api-client';
import { Bell, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

type AlertItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  href: string;
  status?: string;
  at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoices, visitors, incidents] = await Promise.all([
        listCustomerInvoices().catch(() => [] as Invoice[]),
        listCustomerVisitors().catch(() => [] as VisitorAppointment[]),
        getCustomerPortalIncidents().catch(() => [] as PortalIncident[]),
      ]);

      const alerts: AlertItem[] = [];

      for (const inv of invoices) {
        const s = inv.status.toUpperCase();
        if (s.includes('OVERDUE') || s.includes('SENT') || s.includes('PARTIAL')) {
          alerts.push({
            id: `inv-${inv.id}`,
            category: 'Billing',
            title: `${inv.invoiceNumber ?? 'Invoice'} · ${inv.status}`,
            body: `Due ${formatDate(inv.dueDate)} — open Invoices for amount and payment status.`,
            href: '/invoices',
            status: inv.status,
            at: inv.dueDate ?? '',
          });
        }
      }

      for (const v of visitors) {
        if (v.status.toUpperCase() === 'PENDING') {
          alerts.push({
            id: `vis-${v.id}`,
            category: 'Visitors',
            title: `Pending visitor · ${v.visitorName ?? 'Guest'}`,
            body: v.purpose ?? v.referenceNumber ?? 'Awaiting host decision',
            href: '/visitors',
            status: v.status,
            at: v.validFrom ?? v.createdAt ?? '',
          });
        }
      }

      for (const inc of incidents) {
        const s = inc.status.toUpperCase();
        if (s === 'OPEN' || s === 'INVESTIGATING') {
          alerts.push({
            id: `inc-${inc.id}`,
            category: 'Incidents',
            title: `${inc.incidentNumber} · ${inc.title}`,
            body: `${inc.severity} · ${inc.siteName ?? inc.siteCode ?? 'Site'}`,
            href: '/incidents',
            status: inc.status,
            at: inc.createdAt,
          });
        }
      }

      alerts.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      setItems(alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, [items]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Account"
        title="Alerts"
        subtitle="Actionable notices derived from your invoices, visitors and site incidents — scoped to your organisation only."
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

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <PortalStat label="Open alerts" value={loading ? '—' : items.length} tone="amber" />
        <PortalStat label="Billing" value={loading ? '—' : byCat.Billing ?? 0} href="/invoices" tone="rose" />
        <PortalStat label="Visitors" value={loading ? '—' : byCat.Visitors ?? 0} href="/visitors" tone="sky" />
        <PortalStat label="Incidents" value={loading ? '—' : byCat.Incidents ?? 0} href="/incidents" tone="teal" />
      </div>

      {loading ? (
        <p className="text-sm text-[#605e5c]">Loading alerts…</p>
      ) : items.length === 0 ? (
        <PortalEmpty
          title="Inbox clear"
          description="No overdue invoices, pending visitors or open incidents right now."
          icon={<Bell className="h-5 w-5" />}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="flex items-start gap-4 rounded-2xl border border-[#e1dfdd] bg-white px-4 py-3.5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#0078d4]">
                      {a.category}
                    </span>
                    {a.status ? <StatusPill status={a.status} /> : null}
                    <span className="text-[11px] text-[#8a8886]">
                      {formatDate(a.at, true)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#1b1a19]">
                    {a.title}
                  </p>
                  <p className="text-sm text-[#605e5c]">{a.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PortalDeferral note="Dedicated notifications API (push/SMS inbox) is deferred — this feed is computed from live customer-scoped records." />
    </div>
  );
}
