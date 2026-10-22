'use client';

import {
  accrueMarketingCommission,
  createMarketingCommission,
  listMarketingCommissions,
  listMarketingLeads,
  patchMarketingCommission,
  payMarketingCommission,
  voidMarketingCommission,
  type MarketingCommission,
  type MarketingLead,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

function errText(e: unknown) {
  if (!(e instanceof Error)) return 'Request failed';
  try {
    const j = JSON.parse(e.message) as { message?: string; error?: string };
    return j.message ?? j.error ?? e.message;
  } catch {
    return e.message;
  }
}

const fmt = (n: number, currency = 'TZS') =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

const emptyCreate = {
  beneficiary: '',
  referrerType: 'PARTNER',
  amount: '',
  notes: '',
};

export default function MarketingCommissionsPage() {
  const [rows, setRows] = useState<MarketingCommission[]>([]);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLeadId, setCreateLeadId] = useState('');
  const [create, setCreate] = useState({ ...emptyCreate });

  const [editRow, setEditRow] = useState<MarketingCommission | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editBeneficiary, setEditBeneficiary] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [payRow, setPayRow] = useState<MarketingCommission | null>(null);
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, leadList] = await Promise.all([
        listMarketingCommissions(status ? { status } : undefined),
        listMarketingLeads(),
      ]);
      setRows(list);
      setLeads(leadList.filter((l) => l.stage !== 'LOST'));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const sum = (s: string) =>
    rows.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    if (!createLeadId || !create.beneficiary || !Number(create.amount)) return;
    await run(async () => {
      await createMarketingCommission(createLeadId, {
        beneficiary: create.beneficiary,
        amount: Number(create.amount),
        referrerType: create.referrerType || undefined,
        notes: create.notes || undefined,
      });
      setCreateOpen(false);
      setCreateLeadId('');
      setCreate({ ...emptyCreate });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a19]">
            Referral &amp; BD commissions
          </h2>
          <p className="max-w-3xl text-xs text-[#605e5c]">
            PENDING → ACCRUED → PAID. A second marketing officer (or GM) must
            accrue the row — you cannot accrue your own commission. Marking PAID
            records the Finance payment reference; actual disbursement stays on
            Portal 35.15.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setCreateOpen(true)}
        >
          New commission
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={loading ? '…' : fmt(sum('PENDING'))}
          hint={`${rows.filter((r) => r.status === 'PENDING').length} awaiting accrual`}
          accent="amber"
        />
        <StatCard
          label="Accrued"
          value={loading ? '…' : fmt(sum('ACCRUED'))}
          hint={`${rows.filter((r) => r.status === 'ACCRUED').length} awaiting payment`}
          accent="blue"
        />
        <StatCard
          label="Paid"
          value={loading ? '…' : fmt(sum('PAID'))}
          hint={`${rows.filter((r) => r.status === 'PAID').length} settled`}
          accent="emerald"
        />
        <StatCard
          label="Void"
          value={loading ? '…' : fmt(sum('VOID'))}
          hint={`${rows.filter((r) => r.status === 'VOID').length} cancelled`}
          accent="violet"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['', 'PENDING', 'ACCRUED', 'PAID', 'VOID'].map((s) => (
          <button
            key={s || 'ALL'}
            type="button"
            className={
              status === s
                ? 'rounded-full bg-[#0078d4] px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-[#e1dfdd] bg-white px-3 py-1 text-xs font-medium text-[#605e5c] hover:bg-[#faf9f8]'
            }
            onClick={() => setStatus(s)}
          >
            {s || 'All'}
          </button>
        ))}
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <DataTable
        loading={loading}
        rows={rows}
        keyField="id"
        emptyMessage="No commissions yet — add one, or win a lead with a commission amount."
        columns={[
          {
            key: 'leadCode',
            label: 'Lead',
            render: (r) => (
              <div>
                <p className="font-medium text-[#1b1a19]">{r.leadCode ?? '—'}</p>
                <p className="text-xs text-[#605e5c]">{r.companyName ?? ''}</p>
              </div>
            ),
          },
          {
            key: 'beneficiary',
            label: 'Beneficiary',
            render: (r) => (
              <div>
                <p>{r.beneficiary}</p>
                <p className="text-xs text-[#605e5c]">{r.referrerType ?? '—'}</p>
              </div>
            ),
          },
          {
            key: 'amount',
            label: 'Amount',
            render: (r) => (
              <div>
                <p className="font-medium">{fmt(r.amount, r.currency)}</p>
                {r.paymentReference ? (
                  <p className="text-xs text-[#605e5c]">
                    Ref {r.paymentReference}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <div className="space-y-0.5">
                <StatusBadge status={r.status} />
                {r.status === 'PENDING' && !r.canAccrue ? (
                  <p className="text-[11px] text-[#986f0b]">
                    Awaiting second officer
                  </p>
                ) : null}
                {r.voidReason ? (
                  <p className="text-[11px] text-[#605e5c]">{r.voidReason}</p>
                ) : null}
              </div>
            ),
          },
          {
            key: 'accruedAt',
            label: 'Accrued / paid',
            render: (r) => (
              <div className="text-xs text-[#605e5c]">
                <p>
                  {r.accruedAt
                    ? `${r.accruedByName ?? 'Officer'} · ${new Date(r.accruedAt).toLocaleDateString('en-GB')}`
                    : '—'}
                </p>
                <p>
                  {r.paidAt
                    ? `${r.paidByName ?? 'Finance'} · ${new Date(r.paidAt).toLocaleDateString('en-GB')}`
                    : ''}
                </p>
              </div>
            ),
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <div className="flex flex-wrap justify-end gap-2">
                {r.canEdit ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => {
                      setEditRow(r);
                      setEditAmount(String(r.amount));
                      setEditBeneficiary(r.beneficiary);
                      setEditNotes(r.notes ?? '');
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {r.status === 'PENDING' && r.canAccrue ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() =>
                      void run(() => accrueMarketingCommission(r.id))
                    }
                  >
                    Accrue
                  </button>
                ) : null}
                {r.canPay ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => {
                      setPayRow(r);
                      setPayRef('');
                      setPayNotes('');
                    }}
                  >
                    Mark paid
                  </button>
                ) : null}
                {r.canVoid ? (
                  <button
                    type="button"
                    className="text-xs text-red-700 hover:underline"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt('Void reason');
                      if (!reason) return;
                      void run(() => voidMarketingCommission(r.id, reason));
                    }}
                  >
                    Void
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {createOpen ? (
        <Modal title="New commission" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm">
              Lead
              <select
                className={inputCls}
                value={createLeadId}
                onChange={(e) => setCreateLeadId(e.target.value)}
              >
                <option value="">Select lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.companyName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Beneficiary
              <input
                className={inputCls}
                value={create.beneficiary}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, beneficiary: e.target.value }))
                }
                placeholder="Person or partner receiving the commission"
              />
            </label>
            <label className="block text-sm">
              Referrer type
              <select
                className={inputCls}
                value={create.referrerType}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, referrerType: e.target.value }))
                }
              >
                {['STAFF', 'CUSTOMER', 'PARTNER', 'OTHER'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Amount (TZS)
              <input
                className={inputCls}
                type="number"
                min={1}
                value={create.amount}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, amount: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={create.notes}
                onChange={(e) =>
                  setCreate((c) => ({ ...c, notes: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={
                busy ||
                !createLeadId ||
                create.beneficiary.trim().length < 2 ||
                !Number(create.amount)
              }
              onClick={() => void onCreate()}
            >
              Create commission
            </button>
          </div>
        </Modal>
      ) : null}

      {editRow ? (
        <Modal
          title={`Edit commission · ${editRow.leadCode ?? ''}`}
          onClose={() => setEditRow(null)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              Beneficiary
              <input
                className={inputCls}
                value={editBeneficiary}
                onChange={(e) => setEditBeneficiary(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Amount (TZS)
              <input
                className={inputCls}
                type="number"
                min={1}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !Number(editAmount)}
              onClick={() =>
                void run(async () => {
                  await patchMarketingCommission(editRow.id, {
                    beneficiary: editBeneficiary,
                    amount: Number(editAmount),
                    notes: editNotes || null,
                  });
                  setEditRow(null);
                })
              }
            >
              Save changes
            </button>
          </div>
        </Modal>
      ) : null}

      {payRow ? (
        <Modal
          title={`Mark paid · ${payRow.beneficiary}`}
          description={fmt(payRow.amount, payRow.currency)}
          onClose={() => setPayRow(null)}
        >
          <div className="space-y-3">
            <p className="text-xs text-[#605e5c]">
              Record the Finance payment reference so the commission register
              reconciles with the voucher.
            </p>
            <label className="block text-sm">
              Payment reference
              <input
                className={inputCls}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="PV-00042 / bank ref"
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                className={inputCls}
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await payMarketingCommission(payRow.id, {
                    paymentReference: payRef || undefined,
                    notes: payNotes || undefined,
                  });
                  setPayRow(null);
                })
              }
            >
              Confirm paid
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
