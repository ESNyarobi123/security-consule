'use client';

import {
  approvePurchaseOrder,
  approveSupplier,
  createPurchaseOrder,
  createSupplier,
  listPurchaseOrders,
  listSuppliers,
  submitPurchaseOrder,
  type PurchaseOrder,
  type Supplier,
} from '@pssms/api-client';
import {
  btnPrimary,
  btnSecondary,
  DataTable,
  inputCls,
  Modal,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import {
  BadgeCheck,
  ClipboardList,
  Plus,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const money = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

type SupplierForm = { code: string; name: string; email: string; phone: string };
type LineDraft = { description: string; quantity: string; unitPrice: string };
type PoForm = { supplierId: string; poNumber: string; lines: LineDraft[] };

const emptySupplier: SupplierForm = { code: '', name: '', email: '', phone: '' };
const emptyLine: LineDraft = { description: '', quantity: '1', unitPrice: '0' };
const emptyPo = (supplierId: string): PoForm => ({
  supplierId,
  poNumber: `PO-${Date.now().toString().slice(-5)}`,
  lines: [{ ...emptyLine }],
});

export default function ProcurementPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [poForm, setPoForm] = useState<PoForm>(emptyPo(''));
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingPo, setSavingPo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        listSuppliers(),
        listPurchaseOrders(),
      ]);
      setSuppliers(s);
      setPos(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const approved = suppliers.filter((s) => s.status === 'APPROVED').length;
    const totalValue = pos.reduce(
      (sum, p) => sum + (Number.isFinite(p.totalAmount) ? p.totalAmount : 0),
      0,
    );
    const pending = pos.filter((p) => p.status === 'PENDING_APPROVAL').length;
    const drafts = pos.filter((p) => p.status === 'DRAFT').length;
    return { approved, totalValue, pending, drafts };
  }, [suppliers, pos]);

  function openSupplierModal() {
    setSupplierForm(emptySupplier);
    setSupplierOpen(true);
  }

  function openPoModal() {
    const approved = suppliers.find((s) => s.status === 'APPROVED');
    const initial = approved ?? suppliers[0];
    setPoForm(emptyPo(initial?.id ?? ''));
    setPoOpen(true);
  }

  const poTotalPreview = useMemo(
    () =>
      poForm.lines.reduce(
        (sum, l) =>
          sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0,
      ),
    [poForm.lines],
  );

  async function submitSupplier() {
    if (!supplierForm.code.trim() || !supplierForm.name.trim()) {
      setError('Supplier code and name are required');
      return;
    }
    setSavingSupplier(true);
    setError(null);
    try {
      await createSupplier({
        code: supplierForm.code.trim(),
        name: supplierForm.name.trim(),
        email: supplierForm.email.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
      });
      setSupplierOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function submitPo() {
    const supplier = suppliers.find((s) => s.id === poForm.supplierId);
    if (!supplier) {
      setError('Select a supplier for the purchase order');
      return;
    }
    const lines = poForm.lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      }))
      .filter(
        (l) => l.description && l.quantity > 0 && Number.isFinite(l.unitPrice),
      );
    if (lines.length === 0) {
      setError('Add at least one line with a description and quantity');
      return;
    }
    setSavingPo(true);
    setError(null);
    try {
      // A PO can only be raised against an approved supplier — approve inline if needed.
      if (supplier.status !== 'APPROVED') {
        await approveSupplier(supplier.id);
      }
      await createPurchaseOrder({
        supplierId: supplier.id,
        poNumber: poForm.poNumber.trim() || `PO-${Date.now().toString().slice(-5)}`,
        lines,
      });
      setPoOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create purchase order');
    } finally {
      setSavingPo(false);
    }
  }

  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setPoForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setPoForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyLine }] }));
  }

  function removeLine(idx: number) {
    setPoForm((prev) => ({
      ...prev,
      lines:
        prev.lines.length > 1
          ? prev.lines.filter((_, i) => i !== idx)
          : prev.lines,
    }));
  }

  const supplierName = useCallback(
    (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—',
    [suppliers],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="Manage suppliers and purchase orders — onboard vendors, raise POs, submit and approve."
        actions={
          <>
            <button type="button" onClick={openSupplierModal} className={btnSecondary}>
              <Plus className="h-4 w-4" />
              New supplier
            </button>
            <button type="button" onClick={openPoModal} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              New purchase order
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-md border-l-4 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Suppliers"
          value={suppliers.length}
          hint="Registered vendors"
          icon={<Truck className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Approved suppliers"
          value={stats.approved}
          hint={
            suppliers.length
              ? `${stats.approved} of ${suppliers.length} approved`
              : 'None yet'
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Purchase orders"
          value={pos.length}
          hint={`${stats.drafts} draft · ${stats.pending} pending approval`}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Total PO value"
          value={money(stats.totalValue)}
          hint="Across all purchase orders"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <section>
        <SectionTitle>Suppliers</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={suppliers}
          emptyMessage="No suppliers yet — add your first vendor."
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'email',
              label: 'Contact',
              render: (r) => r.email || r.phone || '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) =>
                r.status !== 'APPROVED' ? (
                  <button
                    type="button"
                    className="text-[#0067b8] hover:underline text-xs font-medium"
                    onClick={() => void approveSupplier(r.id).then(load)}
                  >
                    Approve
                  </button>
                ) : (
                  <span className="text-xs text-[#605e5c]">—</span>
                ),
            },
          ]}
        />
      </section>

      <section>
        <SectionTitle>Purchase orders</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={pos}
          emptyMessage="No purchase orders yet — raise one against an approved supplier."
          columns={[
            { key: 'poNumber', label: 'PO #' },
            {
              key: 'supplierId',
              label: 'Supplier',
              render: (r) => supplierName(r.supplierId),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'totalAmount',
              label: 'Total',
              render: (r) => (
                <span className="font-medium text-[#1b1a19]">
                  {money(r.totalAmount, r.currency)}
                </span>
              ),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <div className="flex gap-3">
                  {r.status === 'DRAFT' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void submitPurchaseOrder(r.id).then(load)}
                    >
                      Submit
                    </button>
                  ) : null}
                  {r.status === 'PENDING_APPROVAL' ? (
                    <button
                      type="button"
                      className="text-[#0067b8] hover:underline text-xs font-medium"
                      onClick={() => void approvePurchaseOrder(r.id).then(load)}
                    >
                      Approve
                    </button>
                  ) : null}
                  {r.status !== 'DRAFT' && r.status !== 'PENDING_APPROVAL' ? (
                    <span className="text-xs text-[#605e5c]">—</span>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </section>

      {supplierOpen ? (
        <Modal
          title="New supplier"
          description="Register a vendor. Approve it before raising purchase orders."
          onClose={() => setSupplierOpen(false)}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Code</span>
                <input
                  className={inputCls}
                  value={supplierForm.code}
                  placeholder="SUP-001"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Name</span>
                <input
                  className={inputCls}
                  value={supplierForm.name}
                  placeholder="Acme Security Supplies"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Email</span>
                <input
                  className={inputCls}
                  type="email"
                  value={supplierForm.email}
                  placeholder="sales@acme.co.tz"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Phone</span>
                <input
                  className={inputCls}
                  value={supplierForm.phone}
                  placeholder="+255 700 000 000"
                  onChange={(e) =>
                    setSupplierForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setSupplierOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={savingSupplier}
                onClick={() => void submitSupplier()}
              >
                {savingSupplier ? 'Saving…' : 'Create supplier'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {poOpen ? (
        <Modal
          title="New purchase order"
          description="Raise a PO against a supplier. Unapproved suppliers are approved on submit."
          onClose={() => setPoOpen(false)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">Supplier</span>
                <select
                  className={inputCls}
                  value={poForm.supplierId}
                  onChange={(e) =>
                    setPoForm((f) => ({ ...f, supplierId: e.target.value }))
                  }
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.status === 'APPROVED' ? '' : ' (needs approval)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#323130]">PO number</span>
                <input
                  className={inputCls}
                  value={poForm.poNumber}
                  onChange={(e) =>
                    setPoForm((f) => ({ ...f, poNumber: e.target.value }))
                  }
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[#323130]">Lines</span>
                <button
                  type="button"
                  className="text-[#0067b8] hover:underline text-xs font-medium inline-flex items-center gap-1"
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </button>
              </div>
              <div className="space-y-2">
                {poForm.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2"
                  >
                    <input
                      className={inputCls}
                      value={line.description}
                      placeholder="Description"
                      onChange={(e) =>
                        updateLine(idx, { description: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      value={line.quantity}
                      placeholder="Qty"
                      onChange={(e) =>
                        updateLine(idx, { quantity: e.target.value })
                      }
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={line.unitPrice}
                      placeholder="Unit price"
                      onChange={(e) =>
                        updateLine(idx, { unitPrice: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove line"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[#605e5c] transition hover:bg-[#f3f2f1] hover:text-rose-600 disabled:opacity-40"
                      disabled={poForm.lines.length === 1}
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-[#f3f9fd] px-4 py-3">
              <span className="text-sm font-medium text-[#605e5c]">
                Estimated total
              </span>
              <span className="text-lg font-semibold text-[#1b1a19]">
                {money(poTotalPreview)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setPoOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={savingPo}
                onClick={() => void submitPo()}
              >
                {savingPo ? 'Creating…' : 'Create purchase order'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
