'use client';

import {
  getInventoryReports,
  getProcurementReports,
  listAssets,
  type Asset,
  type InventoryReport,
  type ProcurementReport,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  Boxes,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Shirt,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ProcurementOverviewPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canBuy = can(session, 'procurement.manage');
  const canStock = can(session, 'inventory.manage');
  const canAssets = can(session, 'assets.manage');

  const [buy, setBuy] = useState<ProcurementReport | null>(null);
  const [stock, setStock] = useState<InventoryReport | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<void>[] = [];
      if (canBuy) {
        tasks.push(
          getProcurementReports().then((p) => {
            setBuy(p);
          }),
        );
      }
      if (canStock) {
        tasks.push(
          getInventoryReports().then((p) => {
            setStock(p);
          }),
        );
      }
      if (canAssets) {
        tasks.push(
          listAssets().then((rows) => {
            setAssets(rows);
          }),
        );
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [canBuy, canStock, canAssets]);

  useEffect(() => {
    void load();
  }, [load]);

  const issued = assets.filter((a) => a.status === 'ASSIGNED').length;
  const available = assets.filter((a) => a.status === 'AVAILABLE').length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a3412]">
            Portal 35.18 · Procurement & Inventory
          </p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[#1b1a19] md:text-[30px]">
            Buy, receive, stock, and issue
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#605e5c]">
            Procurement officers run purchase requests, supplier comparison, and
            POs. Storekeepers receive GRNs and keep uniforms, boots, phones,
            radios, CCTV, parking, and office stock. Issued serialized kit lives
            on Assets. Finance AP stays on Portal 35.15. Vendors use 35.17.
            No extra Procurement Manager role — that job is{' '}
            <span className="font-medium text-[#323130]">PROCUREMENT_OFFICER</span>
            . Branch Managers and Finance Officers are not granted buying mutate
            on seed; GM approves PRs/POs on /approvals.
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-md border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canBuy ? (
          <>
            <StatCard
              label="Suppliers pending"
              value={loading ? '—' : (buy?.suppliersPending ?? 0)}
              hint={`${buy?.suppliersApproved ?? 0} approved`}
              icon={<Truck className="h-5 w-5" />}
              accent="blue"
            />
            <StatCard
              label="PRs awaiting approval"
              value={loading ? '—' : (buy?.purchaseRequestsPendingApproval ?? 0)}
              hint={`${buy?.purchaseRequestsApproved ?? 0} approved`}
              icon={<ClipboardList className="h-5 w-5" />}
              accent="amber"
            />
            <StatCard
              label="Open purchase orders"
              value={loading ? '—' : (buy?.purchaseOrdersOpen ?? 0)}
              hint={`${buy?.goodsReceiptsTotal ?? 0} GRNs posted`}
              icon={<PackageCheck className="h-5 w-5" />}
              accent="emerald"
            />
          </>
        ) : null}
        {canStock ? (
          <StatCard
            label="Below reorder"
            value={loading ? '—' : (stock?.belowReorder ?? 0)}
            hint={`${stock?.onHandUnits ?? 0} units on hand`}
            icon={<Boxes className="h-5 w-5" />}
            accent="rose"
          />
        ) : null}
        {canAssets ? (
          <StatCard
            label="Assets issued"
            value={loading ? '—' : issued}
            hint={`${available} available on register`}
            icon={<Shirt className="h-5 w-5" />}
            accent="violet"
          />
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {canBuy ? (
          <GlassCard>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
              Buying
            </p>
            <p className="mt-1 text-sm text-[#323130]">
              PRs, quote compare, POs, vendor inbox
            </p>
            <Link
              href="/procurement/buying"
              className="mt-3 inline-block text-sm font-semibold text-[#0067b8] hover:underline"
            >
              Open buying →
            </Link>
          </GlassCard>
        ) : null}
        {canStock ? (
          <GlassCard>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
              Inventory
            </p>
            <p className="mt-1 text-sm text-[#323130]">
              GRNs, uniforms, boots, radios, CCTV, parking, office
            </p>
            <Link
              href="/procurement/inventory"
              className="mt-3 inline-block text-sm font-semibold text-[#0067b8] hover:underline"
            >
              Open stock →
            </Link>
          </GlassCard>
        ) : null}
        {canAssets ? (
          <GlassCard>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
              Issued assets
            </p>
            <p className="mt-1 text-sm text-[#323130]">
              Assign / return serialized kit (storekeeper SoD)
            </p>
            <Link
              href="/assets"
              className="mt-3 inline-block text-sm font-semibold text-[#0067b8] hover:underline"
            >
              Open assets →
            </Link>
          </GlassCard>
        ) : null}
        <GlassCard>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
            Supplier portal
          </p>
          <p className="mt-1 text-sm text-[#323130]">
            Vendors register and quote on 35.17 — not this console
          </p>
          <p className="mt-3 text-xs text-[#8a8886]">
            Demo login portal@uniforms.co.tz on supplier-web :3003
          </p>
        </GlassCard>
      </div>

      {stock?.byCategory?.length ? (
        <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white">
          <div className="border-b border-[#edebe9] px-4 py-2.5 text-[12px] font-semibold text-[#323130]">
            Stock by category
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf9f8] text-[10px] font-semibold uppercase tracking-wide text-[#8a8886]">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">On hand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1]">
              {stock.byCategory.map((row) => (
                <tr key={row.category}>
                  <td className="px-4 py-2">{row.category.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2 tabular-nums">{row.items}</td>
                  <td className="px-4 py-2 tabular-nums">{row.onHand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {buy?.notes?.length || stock?.notes?.length ? (
        <p className="text-[11px] text-[#8a8886]">
          {[...(buy?.notes ?? []), ...(stock?.notes ?? [])].join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
