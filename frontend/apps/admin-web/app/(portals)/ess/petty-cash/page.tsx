'use client';

import {
  applyEssPettyCash,
  listEssPettyCash,
  type EssPettyCashVoucher,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Plus, RefreshCw, Wallet } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  formatMoney,
  isEssProfileMissing,
} from '../_components/shared';

const CATEGORIES = [
  'TRANSPORT',
  'STATIONERY',
  'COMMUNICATION',
  'MEALS',
  'OTHER',
] as const;

export default function EssPettyCashPage() {
  const [rows, setRows] = useState<EssPettyCashVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssPettyCash());
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <EssShell
      title="Petty cash"
      description="Request spend against the company imprest fund. Finance approves separately (you cannot approve your own request)."
      actions={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            className={btnPrimary}
            disabled={missing}
          >
            <Plus className="h-3.5 w-3.5" />
            Request petty cash
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<Wallet className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Wallet className="h-4 w-4" />}
                title="No petty cash requests"
                description="Submit a request for transport, stationery, or other imprest spend."
              />
            </div>
          ) : (
            <DataTable<EssPettyCashVoucher>
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No petty cash"
              columns={[
                {
                  key: 'voucherNumber',
                  label: 'Voucher #',
                  render: (r) => (
                    <span className="font-mono text-sm">{r.voucherNumber}</span>
                  ),
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  render: (r) => formatMoney(r.amount),
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: (r) => (
                    <span className="text-xs">{r.category}</span>
                  ),
                },
                {
                  key: 'purpose',
                  label: 'Purpose',
                  render: (r) => (
                    <span
                      className="max-w-[180px] truncate text-xs text-[#605e5c]"
                      title={r.purpose}
                    >
                      {r.purpose}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge status={r.status} />
                      {r.status === 'REIMBURSED' && r.reimbursedAt ? (
                        <span className="text-[10px] text-[#605e5c]">
                          Reimbursed {formatDate(r.reimbursedAt)}
                        </span>
                      ) : null}
                      {r.status === 'REIMBURSED' && r.receiptUrl ? (
                        <span
                          className="max-w-[160px] truncate text-[10px] text-[#0078d4]"
                          title="Receipt on file with finance"
                        >
                          {r.receiptUrl.startsWith('document:')
                            ? 'Receipt on file (finance)'
                            : r.receiptUrl.startsWith('http')
                              ? 'Receipt link on file'
                              : 'Receipt ref on file'}
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Submitted',
                  render: (r) => formatDate(r.createdAt),
                },
              ]}
            />
          )}
        </GlassCard>
      )}

      {applyOpen ? (
        <ApplyPettyCashModal
          onClose={() => setApplyOpen(false)}
          onCreated={async () => {
            setApplyOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </EssShell>
  );
}

function ApplyPettyCashModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('25000');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await applyEssPettyCash({
        amount: Number(amount),
        category,
        purpose: purpose.trim(),
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Request petty cash"
      description="Uses the HQ imprest fund. Finance / GM must approve before cash is issued."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Amount (TZS)
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Purpose
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="e.g. Taxi to site inspection"
            required
            minLength={3}
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
