'use client';

import {
  listSupplierOrders,
  type SupplierPurchaseOrder,
} from '@pssms/api-client';
import {
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalError,
  PortalHero,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

type Filter = 'ALL' | 'OPEN' | 'CLOSED';

function isOpenStatus(status: string) {
  const s = status.toUpperCase();
  return (
    s.includes('ORDER') ||
    s.includes('PENDING') ||
    s.includes('APPROVED') ||
    s.includes('ISSUED') ||
    s.includes('SENT') ||
    s.includes('PARTIAL') ||
    s.includes('OPEN')
  );
}

function isClosedStatus(status: string) {
  const s = status.toUpperCase();
  return (
    s.includes('CLOSED') ||
    s.includes('RECEIVED') ||
    s.includes('COMPLETED') ||
    s.includes('CANCEL') ||
    s.includes('REJECT') ||
    s.includes('VOID')
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<SupplierPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listSupplierOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...orders]
      .filter((po) => {
        if (filter === 'OPEN' && !isOpenStatus(po.status)) return false;
        if (filter === 'CLOSED' && !isClosedStatus(po.status)) return false;
        if (!q) return true;
        return (
          po.poNumber.toLowerCase().includes(q) ||
          po.status.toLowerCase().includes(q) ||
          po.lines.some((l) => l.description.toLowerCase().includes(q))
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, filter, query]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      open: orders.filter((o) => isOpenStatus(o.status)).length,
      closed: orders.filter((o) => isClosedStatus(o.status)).length,
    }),
    [orders],
  );

  return (
    <>
      <PortalHero
        eyebrow="Commerce"
        title="Purchase orders"
        subtitle="POs issued to your company by HIGHLINK procurement. Expand a row to see line items."
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ALL', `All (${counts.all})`],
              ['OPEN', `Open (${counts.open})`],
              ['CLOSED', `Closed (${counts.closed})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? 'bg-[#ea580c] text-white shadow-sm'
                  : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#faf9f8]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a19f9d]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PO number or line…"
            className="w-full rounded-xl border border-[#e1dfdd] bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/15"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-[#605e5c]">Loading purchase orders…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-gradient-to-br from-white to-amber-50/40 px-6 py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-sm font-semibold text-[#1b1a19]">
            No matching purchase orders
          </p>
          <p className="mt-1 text-xs text-[#605e5c]">
            Try another filter, or wait for HIGHLINK to issue a PO.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((po) => {
            const open = expanded === po.id;
            return (
              <li
                key={po.id}
                className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm transition hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : po.id)}
                  className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-base font-bold text-[#1b1a19]">
                        {po.poNumber}
                      </p>
                      <StatusPill status={po.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#605e5c]">
                      Created {formatDate(po.createdAt, true)}
                      {po.expectedDelivery
                        ? ` · Expected ${formatDate(po.expectedDelivery)}`
                        : ''}
                      {` · ${po.lines.length} line${po.lines.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold tracking-tight text-[#1b1a19]">
                      {money(po.totalAmount, po.currency)}
                    </p>
                    {open ? (
                      <ChevronUp className="h-5 w-5 text-[#605e5c]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[#605e5c]" />
                    )}
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-[#605e5c]">
                            <th className="pb-2 pr-3 font-semibold">
                              Description
                            </th>
                            <th className="pb-2 pr-3 font-semibold">Qty</th>
                            <th className="pb-2 pr-3 font-semibold">
                              Unit price
                            </th>
                            <th className="pb-2 pr-3 font-semibold">Amount</th>
                            <th className="pb-2 font-semibold">Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edebe9]">
                          {po.lines.map((line) => (
                            <tr key={line.id} className="text-[#323130]">
                              <td className="py-2.5 pr-3">
                                {line.description}
                              </td>
                              <td className="py-2.5 pr-3 tabular-nums">
                                {line.quantity}
                              </td>
                              <td className="py-2.5 pr-3 tabular-nums">
                                {money(line.unitPrice, po.currency)}
                              </td>
                              <td className="py-2.5 pr-3 font-medium tabular-nums">
                                {money(line.amount, po.currency)}
                              </td>
                              <td className="py-2.5 tabular-nums">
                                {line.receivedQty}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
