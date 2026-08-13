'use client';

import {
  createGoodsReceipt,
  createStockItem,
  listReceivingQueue,
  listStockAlerts,
  listStockItems,
  recordStockMovement,
  updateStockItem,
  type PurchaseOrder,
  type StockItem,
} from '@pssms/api-client';
import {
  btnPrimary,
  btnSecondary,
  inputCls,
  Modal,
  PageHeader,
  StatCard,
} from '@pssms/ui';
import {
  AlertTriangle,
  Boxes,
  PackageCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const CATEGORIES = [
  'UNIFORMS',
  'BOOTS',
  'RADIOS',
  'CCTV',
  'ACCESS_DEVICES',
  'STATIONERY',
  'OTHER',
];

const money = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [alerts, setAlerts] = useState<StockItem[]>([]);
  const [queue, setQueue] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'UNIFORMS',
    reorderLevel: '10',
  });
  const [saving, setSaving] = useState(false);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [i, a, q] = await Promise.all([
        listStockItems(),
        listStockAlerts(),
        listReceivingQueue(),
      ]);
      setItems(i);
      setAlerts(a);
      setQueue(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onHandValue = useMemo(
    () => items.reduce((sum, i) => sum + i.onHand, 0),
    [items],
  );

  async function saveItem() {
    if (!form.sku.trim() || !form.name.trim()) {
      setError('SKU and name are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createStockItem({
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category,
        reorderLevel: Number(form.reorderLevel) || 0,
      });
      setItemOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create item');
    } finally {
      setSaving(false);
    }
  }

  async function saveReorder(item: StockItem, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    try {
      await updateStockItem(item.id, { reorderLevel: n });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function submitReceive() {
    if (!receivePo?.lines?.length) return;
    const lines = receivePo.lines
      .map((l) => ({
        purchaseOrderLineId: l.id,
        quantityReceived: Number(receiveQty[l.id] || 0),
      }))
      .filter((l) => l.quantityReceived > 0);
    if (!lines.length) {
      setError('Enter a received quantity');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createGoodsReceipt(receivePo.id, { lines });
      setReceivePo(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GRN failed');
    } finally {
      setSaving(false);
    }
  }

  async function submitAdjust() {
    if (!adjustItem) return;
    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordStockMovement({
        stockItemId: adjustItem.id,
        movementType: adjustType,
        quantity: qty,
        notes: 'Manual inventory adjustment',
      });
      setAdjustItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Movement failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels, reorder alerts, and goods received notes for uniforms, boots, radios and devices."
        actions={
          <>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setForm({
                  sku: '',
                  name: '',
                  category: 'UNIFORMS',
                  reorderLevel: '10',
                });
                setItemOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New stock item
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-md border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock items"
          value={items.length}
          hint={`${onHandValue} units on hand`}
          icon={<Boxes className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Below reorder"
          value={alerts.length}
          hint="Stock alerts"
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Awaiting GRN"
          value={queue.length}
          hint="Approved POs to receive"
          icon={<PackageCheck className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {alerts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Stock alerts</p>
          <ul className="mt-2 space-y-1">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.sku} {a.name} — on hand {a.onHand} / reorder {a.reorderLevel}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-[#1b1a19]">
          Stock register
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white">
          {loading && items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#605e5c]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#605e5c]">No stock items yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#faf9f8] text-[10px] font-semibold uppercase tracking-wide text-[#8a8886]">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">On hand</th>
                  <th className="px-4 py-2">Reorder</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f2f1]">
                {items.map((i) => (
                  <tr key={i.id} className={i.belowReorder ? 'bg-amber-50/60' : ''}>
                    <td className="px-4 py-2 font-mono text-xs">{i.sku}</td>
                    <td className="px-4 py-2 font-medium">{i.name}</td>
                    <td className="px-4 py-2 text-[#605e5c]">
                      {i.category ?? '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{i.onHand}</td>
                    <td className="px-4 py-2">
                      <input
                        className="w-20 rounded border border-[#e1dfdd] px-2 py-1 text-sm"
                        defaultValue={i.reorderLevel ?? ''}
                        onBlur={(e) => void saveReorder(i, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => {
                          setAdjustItem(i);
                          setAdjustQty('1');
                          setAdjustType('IN');
                        }}
                      >
                        Move
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-[#1b1a19]">
          Goods received
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white">
          {queue.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#605e5c]">
              No ordered purchase orders waiting for a GRN.
            </p>
          ) : (
            <ul className="divide-y divide-[#f3f2f1]">
              {queue.map((po) => (
                <li
                  key={po.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold">{po.poNumber}</p>
                    <p className="text-xs text-[#605e5c]">
                      {po.supplierName ?? po.supplierCode ?? po.supplierId} ·{' '}
                      {money(po.totalAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      setReceivePo(po);
                      const next: Record<string, string> = {};
                      for (const l of po.lines ?? []) {
                        const remain = Math.max(0, l.quantity - l.receivedQty);
                        next[l.id] = remain ? String(remain) : '0';
                      }
                      setReceiveQty(next);
                    }}
                  >
                    Receive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {itemOpen ? (
        <Modal
          title="New stock item"
          description="Uniforms, boots, radios, CCTV and access devices."
          onClose={() => setItemOpen(false)}
        >
          <label className="block text-sm">
            SKU
            <input
              className={inputCls}
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-sm">
            Name
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-sm">
            Category
            <select
              className={inputCls}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Reorder level
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.reorderLevel}
              onChange={(e) =>
                setForm((f) => ({ ...f, reorderLevel: e.target.value }))
              }
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setItemOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => void saveItem()}
            >
              Save
            </button>
          </div>
        </Modal>
      ) : null}

      {receivePo ? (
        <Modal
          title={`GRN · ${receivePo.poNumber}`}
          description="Received quantities post IN to inventory when the PO line has a stock item."
          onClose={() => setReceivePo(null)}
        >
          <div className="space-y-2">
            {(receivePo.lines ?? []).map((l) => (
              <label key={l.id} className="block text-sm">
                {l.description} (ordered {l.quantity}, received {l.receivedQty})
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={receiveQty[l.id] ?? ''}
                  onChange={(e) =>
                    setReceiveQty((q) => ({ ...q, [l.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setReceivePo(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => void submitReceive()}
            >
              Post GRN
            </button>
          </div>
        </Modal>
      ) : null}

      {adjustItem ? (
        <Modal
          title={`Stock movement · ${adjustItem.sku}`}
          onClose={() => setAdjustItem(null)}
        >
          <label className="block text-sm">
            Type
            <select
              className={inputCls}
              value={adjustType}
              onChange={(e) =>
                setAdjustType(e.target.value as 'IN' | 'OUT' | 'ADJUST')
              }
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
              <option value="ADJUST">ADJUST (set on-hand)</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Quantity
            <input
              className={inputCls}
              type="number"
              min={0.01}
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setAdjustItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => void submitAdjust()}
            >
              Record
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
