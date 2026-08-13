'use client';

import {
  createMySupplierSubmission,
  getSupplierMe,
  listMySupplierSubmissions,
  listSupplierOrders,
  type SupplierProfile,
  type SupplierPurchaseOrder,
  type SupplierSubmission,
} from '@pssms/api-client';
import { Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentStrip } from '../../_components/document-strip';
import {
  PortalError,
  PortalHero,
  PortalPanel,
  StatusPill,
  formatDate,
  money,
} from '../../_components/portal-ui';

const KINDS = [
  { id: 'QUOTATION', label: 'Quotation' },
  { id: 'INVOICE', label: 'Invoice' },
  { id: 'DELIVERY_NOTE', label: 'Delivery note' },
  { id: 'PAYMENT_REQUEST', label: 'Payment request' },
] as const;

const inputCls =
  'mt-1 w-full rounded-lg border border-[#c8c6c4] bg-white px-3 py-2 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20';

function kindLabel(kind: string) {
  return KINDS.find((k) => k.id === kind)?.label ?? kind.replace(/_/g, ' ');
}

export default function SubmissionsPage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [rows, setRows] = useState<SupplierSubmission[]>([]);
  const [orders, setOrders] = useState<SupplierPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: 'QUOTATION',
    title: '',
    description: '',
    amount: '',
    purchaseOrderId: '',
  });

  const approved = me?.status === 'APPROVED';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, list, pos] = await Promise.all([
        getSupplierMe(),
        listMySupplierSubmissions(),
        listSupplierOrders().catch(() => [] as SupplierPurchaseOrder[]),
      ]);
      setMe(profile);
      setRows(list);
      setOrders(pos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const submitted = rows.filter((r) => r.status === 'SUBMITTED').length;
    const approvedN = rows.filter((r) => r.status === 'APPROVED').length;
    const rejected = rows.filter((r) => r.status === 'REJECTED').length;
    const unpaid = rows.filter((r) => r.paymentStatus === 'UNPAID').length;
    return { submitted, approvedN, rejected, unpaid };
  }, [rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount = form.amount.trim() ? Number(form.amount) : undefined;
      if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
        throw new Error('Amount must be a non-negative number');
      }
      await createMySupplierSubmission({
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        amount,
        purchaseOrderId: form.purchaseOrderId || undefined,
      });
      setOpen(false);
      setForm({
        kind: 'QUOTATION',
        title: '',
        description: '',
        amount: '',
        purchaseOrderId: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalHero
        eyebrow="Commerce"
        title="Quotes & invoices"
        subtitle="Submit quotations, invoices, delivery notes and payment requests. Track approval and payment status on your own documents only."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              disabled={!approved}
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#9a3412] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New submission
            </button>
          </>
        }
      />

      {error ? <PortalError message={error} /> : null}

      {!approved && me ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Submissions are locked until HIGHLINK approves your registration
          ({me.status}).
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Submitted <strong>{counts.submitted}</strong>
        </p>
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Approved <strong>{counts.approvedN}</strong>
        </p>
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Rejected <strong>{counts.rejected}</strong>
        </p>
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Unpaid <strong>{counts.unpaid}</strong>
        </p>
      </div>

      <PortalPanel title="Your submissions">
        {loading ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#605e5c]">
            No quotations, invoices, delivery notes or payment requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#edebe9]">
            {rows.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-[#8a8886]">
                      {r.referenceNumber}
                      {r.poNumber ? ` · ${r.poNumber}` : ''}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#1b1a19]">
                      {kindLabel(r.kind)} · {r.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#605e5c]">
                      {formatDate(r.createdAt)}
                      {r.amount != null
                        ? ` · ${money(r.amount, r.currency)}`
                        : ''}
                    </p>
                    {r.rejectedReason ? (
                      <p className="mt-1 text-xs text-rose-700">
                        Rejected: {r.rejectedReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={r.status} />
                    {r.paymentStatus && r.paymentStatus !== 'NONE' ? (
                      <StatusPill status={r.paymentStatus} />
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  <DocumentStrip
                    resourceType="SupplierSubmission"
                    resourceId={r.id}
                    label="Supporting files"
                    hint="Quote, tax invoice, delivery note or payment request scan."
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PortalPanel>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={onCreate}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#1b1a19]">
              New submission
            </h3>
            <label className="mt-4 block text-sm font-medium">
              Type
              <select
                className={inputCls}
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value }))
                }
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium">
              Title
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Linked purchase order
              <select
                className={inputCls}
                value={form.purchaseOrderId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purchaseOrderId: e.target.value }))
                }
              >
                <option value="">None</option>
                {orders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium">
              Amount (optional)
              <input
                className={inputCls}
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Notes
              <textarea
                className={inputCls}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#c8c6c4] px-3 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#ea580c] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
