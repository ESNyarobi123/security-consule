'use client';

import {
  applyEssLoan,
  listEssLoans,
  type EssLoan,
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
import { Coins, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  formatMoney,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssLoansPage() {
  const [rows, setRows] = useState<EssLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssLoans());
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
      title="Loans"
      description="Apply for employee loans and track approval status."
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
            Apply loan
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
          icon={<Coins className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login. Contact HR before applying for a loan."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Coins className="h-4 w-4" />}
                title="No loans"
                description="Apply for boots, uniform, cash, or other employee loans."
              />
            </div>
          ) : (
            <DataTable<EssLoan>
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No loans"
              columns={[
                {
                  key: 'loanNumber',
                  label: 'Loan #',
                  render: (r) => (
                    <span className="font-mono text-sm">{r.loanNumber}</span>
                  ),
                },
                {
                  key: 'principalAmount',
                  label: 'Principal',
                  render: (r) => formatMoney(r.principalAmount),
                },
                {
                  key: 'termMonths',
                  label: 'Term',
                  render: (r) => (
                    <span className="text-xs">{r.termMonths} mo</span>
                  ),
                },
                {
                  key: 'monthlyInstallment',
                  label: 'Installment',
                  render: (r) => formatMoney(r.monthlyInstallment),
                },
                {
                  key: 'purpose',
                  label: 'Purpose',
                  render: (r) => (
                    <span
                      className="max-w-[160px] truncate text-xs text-[#605e5c]"
                      title={r.purpose}
                    >
                      {r.purpose}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
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
        <ApplyLoanModal
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

function ApplyLoanModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [principal, setPrincipal] = useState('');
  const [termMonths, setTermMonths] = useState('6');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await applyEssLoan({
        principalAmount: Number(principal),
        termMonths: Number(termMonths),
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
      title="Apply for loan"
      description="Starts the loan-approval workflow for you only."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Principal (TZS)
          <input
            type="number"
            min={1}
            step={1}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className={inputCls}
            placeholder="500000"
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Term (months)
          <input
            type="number"
            min={1}
            max={60}
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            className={inputCls}
            required
          />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Purpose
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="e.g. Boots, uniform, emergency advance"
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
