'use client';

import {
  getSupplierMe,
  listSupplierOrders,
  type SupplierProfile,
  type SupplierPurchaseOrder,
} from '@pssms/api-client';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Package,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

function isOpenStatus(status: string) {
  const s = status.toUpperCase();
  return (
    s.includes('PENDING') ||
    s.includes('APPROVED') ||
    s.includes('ISSUED') ||
    s.includes('SENT') ||
    s.includes('PARTIAL') ||
    s.includes('OPEN')
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [orders, setOrders] = useState<SupplierPurchaseOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, pos] = await Promise.all([
        getSupplierMe(),
        listSupplierOrders(),
      ]);
      setMe(profile);
      setOrders(pos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = orders.filter((o) => isOpenStatus(o.status));
    const currency = orders[0]?.currency ?? 'TZS';
    const openValue = open.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    return {
      total: orders.length,
      open: open.length,
      openValue,
      currency,
    };
  }, [orders]);

  const recent = useMemo(
    () =>
      [...orders]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [orders],
  );

  return (
    <>
      <PortalHero
        eyebrow="Portal 35.17 · Supplier"
        title={me ? `Welcome, ${me.name}` : 'Supplier overview'}
        subtitle="Track purchase orders issued to your company and keep your registration details current."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat
          label="Purchase orders"
          value={loading ? '—' : stats.total}
          hint="All POs on your account"
          href="/orders"
          tone="amber"
        />
        <PortalStat
          label="Open / in progress"
          value={loading ? '—' : stats.open}
          hint="Awaiting fulfilment"
          href="/orders"
          tone="sky"
        />
        <PortalStat
          label="Open PO value"
          value={loading ? '—' : money(stats.openValue, stats.currency)}
          hint={stats.currency}
          tone="emerald"
        />
        <PortalStat
          label="Account status"
          value={loading ? '—' : (me?.status ?? '—')}
          hint={me?.code ?? 'Supplier code'}
          href="/profile"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PortalPanel
            title="Recent purchase orders"
            action={
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#ea580c] hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-[#605e5c]">Loading orders…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-[#605e5c]">
                No purchase orders yet. When HIGHLINK issues a PO, it appears
                here.
              </p>
            ) : (
              <ul className="divide-y divide-[#edebe9]">
                {recent.map((po) => (
                  <li
                    key={po.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold text-[#1b1a19]">
                        {po.poNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-[#605e5c]">
                        {formatDate(po.createdAt)}
                        {po.expectedDelivery
                          ? ` · Due ${formatDate(po.expectedDelivery)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-[#1b1a19]">
                        {money(po.totalAmount, po.currency)}
                      </p>
                      <StatusPill status={po.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <PortalPanel title="Company at a glance">
            {loading || !me ? (
              <p className="text-sm text-[#605e5c]">Loading profile…</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#605e5c]">Code</dt>
                  <dd className="font-mono font-medium text-[#1b1a19]">
                    {me.code}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#605e5c]">Email</dt>
                  <dd className="truncate text-right text-[#1b1a19]">
                    {me.email ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#605e5c]">Phone</dt>
                  <dd className="text-[#1b1a19]">{me.phone ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#605e5c]">Status</dt>
                  <dd>
                    <StatusPill status={me.status} />
                  </dd>
                </div>
              </dl>
            )}
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#ea580c] hover:underline"
            >
              Full company profile <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </PortalPanel>

          <div className="grid gap-3">
            <Link
              href="/orders"
              className="group flex items-start gap-3 rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#ea580c]">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-[#1b1a19]">Purchase orders</p>
                <p className="mt-0.5 text-xs text-[#605e5c]">
                  Lines, totals, delivery dates
                </p>
              </div>
              <Package className="ml-auto h-4 w-4 text-[#c8c6c4] transition group-hover:text-[#ea580c]" />
            </Link>
            <Link
              href="/profile"
              className="group flex items-start gap-3 rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0078d4]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-[#1b1a19]">Company profile</p>
                <p className="mt-0.5 text-xs text-[#605e5c]">
                  TIN, address, contact details
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-[#c8c6c4] transition group-hover:text-[#ea580c]" />
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-[#605e5c]">
        Read-only portal · Quotes upload & delivery confirmation come in a later
        slice
      </p>
    </>
  );
}
