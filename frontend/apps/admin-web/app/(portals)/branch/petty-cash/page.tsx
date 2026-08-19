'use client';

import {
  listBranchPettyCash,
  requestBranchPettyCash,
  type PettyCashVoucher,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDate } from '../_components/shared';

const CATEGORIES = [
  'TRANSPORT',
  'STATIONERY',
  'COMMUNICATION',
  'MEALS',
  'OTHER',
] as const;

export default function BranchPettyCashPage() {
  const [rows, setRows] = useState<PettyCashVoucher[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [branches, setBranches] = useState<
    { id: string; code: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('50000');
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState<string>('TRANSPORT');
  const [branchId, setBranchId] = useState('');
  const [department, setDepartment] = useState('Operations');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await listBranchPettyCash();
      setRows(pack.rows);
      setNotes(pack.notes);
      setBranches(pack.branches ?? []);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!branchId && branches[0]) setBranchId(branches[0].id);
  }, [branches, branchId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await requestBranchPettyCash({
        amount: Number(amount),
        purpose,
        category,
        branchId: branchId || undefined,
        department: department || undefined,
      });
      setOpen(false);
      setPurpose('');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <BranchShell
      title="Branch petty cash"
      description="Request imprest spend for the branch. Finance must approve before cash is issued — you cannot issue or approve your own voucher."
      actions={
        <>
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Request
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No petty cash vouchers for your branches"
        columns={[
          { key: 'voucherNumber', label: 'Number' },
          { key: 'purpose', label: 'Purpose' },
          { key: 'amount', label: 'Amount' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          { key: 'branchCode', label: 'Branch' },
          {
            key: 'createdAt',
            label: 'Requested',
            render: (r) => formatDate(String(r.createdAt)),
          },
        ]}
      />
      {notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{notes[0]}</p>
      ) : null}

      {open ? (
        <Modal title="Request petty cash" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            <label className="block text-xs font-medium">
              Amount (TZS)
              <input
                className={inputCls}
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Purpose
              <input
                className={inputCls}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                minLength={3}
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Category
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Branch
              <select
                className={inputCls}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Department
              <input
                className={inputCls}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary}>
                Submit request
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </BranchShell>
  );
}
