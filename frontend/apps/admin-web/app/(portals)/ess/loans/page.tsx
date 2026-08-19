'use client';

import {
  acknowledgeEssLoan,
  applyEssLoan,
  getEssLoanBalance,
  getEssLoanStatement,
  isItemLoanType,
  listEssLoans,
  LOAN_TYPE_OPTIONS,
  type EssLoan,
  type EssLoanBalance,
  type EssLoanStatement,
  type LoanType,
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
  const [balance, setBalance] = useState<EssLoanBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const [list, bal] = await Promise.all([
        listEssLoans(),
        getEssLoanBalance(),
      ]);
      setRows(list);
      setBalance(bal);
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setRows([]);
        setBalance(null);
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
      description="Apply for boots, smartphone, cash, uniform, salary advance, or other approved support loans. Track outstanding balance. HR/GM approve — you cannot approve your own loan."
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
        <>
          {balance ? (
            <p className="mb-3 rounded border border-[#cfe4f7] bg-[#f3f9fd] px-3 py-2 text-xs text-[#323130]">
              Outstanding {formatMoney(balance.outstandingBalance)} ·{' '}
              {balance.activeLoanCount} active · {balance.pendingLoanCount}{' '}
              awaiting approval
            </p>
          ) : null}
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Coins className="h-4 w-4" />}
                title="No loans"
                description="Apply for boots, smartphone, cash, uniform, salary advance, or other approved support."
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
                  key: 'loanType',
                  label: 'Type',
                  render: (r) => (
                    <span className="text-xs">
                      {LOAN_TYPE_OPTIONS.find((t) => t.value === r.loanType)
                        ?.label ??
                        r.loanType?.replace(/_/g, ' ') ??
                        '—'}
                    </span>
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
                  label: 'Item / notes',
                  render: (r) => (
                    <span
                      className="max-w-[160px] truncate text-xs text-[#605e5c]"
                      title={r.itemName ?? r.purpose ?? ''}
                    >
                      {r.itemName ?? r.purpose ?? '—'}
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
                {
                  key: 'id',
                  label: '',
                  render: (r) => (
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => setStatementId(r.id)}
                      >
                        Statement
                      </button>
                      {r.status === 'ACTIVE' &&
                      isItemLoanType(String(r.loanType)) &&
                      !r.employeeAcknowledgedAt ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id}
                          onClick={async () => {
                            setBusyId(r.id);
                            try {
                              await acknowledgeEssLoan(r.id);
                              await refresh();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : String(err),
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Ack item
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
        </>
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

      {statementId ? (
        <EssStatementModal
          loanId={statementId}
          onClose={() => setStatementId(null)}
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
  const [loanType, setLoanType] = useState<LoanType>('CASH');
  const [principal, setPrincipal] = useState('');
  const [termMonths, setTermMonths] = useState('6');
  const [purpose, setPurpose] = useState('');
  const [itemName, setItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemRequired = isItemLoanType(loanType);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await applyEssLoan({
        loanType,
        principalAmount: Number(principal),
        termMonths: Number(termMonths),
        purpose: purpose.trim() || undefined,
        itemName: itemRequired ? itemName.trim() : undefined,
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
      description="Starts approval for boots, smartphone, cash, uniform, salary advance, or other approved support. You cannot approve this yourself."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-[#323130]">
          Loan type
          <select
            value={loanType}
            onChange={(e) => setLoanType(e.target.value as LoanType)}
            className={inputCls}
            required
          >
            {LOAN_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {itemRequired ? (
          <label className="block text-sm font-medium text-[#323130]">
            Item name
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Security boots size 42"
              required
            />
          </label>
        ) : null}
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
          Notes (optional)
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="Optional notes for approver"
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

function EssStatementModal({
  loanId,
  onClose,
}: {
  loanId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<EssLoanStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const stmt = await getEssLoanStatement(loanId);
        if (!cancelled) setData(stmt);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  return (
    <Modal
      title="Loan statement"
      description={
        data?.loan?.loanNumber
          ? `${data.loan.loanNumber} · ${LOAN_TYPE_OPTIONS.find((t) => t.value === data.loan.loanType)?.label ?? data.loan.loanType}`
          : 'Repayment schedule and balance'
      }
      onClose={onClose}
      size="lg"
    >
      {error ? (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="py-6 text-center text-sm text-[#605e5c]">Loading…</p>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Total due</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.totalDue)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Paid</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.totalPaid)}
              </p>
            </div>
            <div className="rounded-lg bg-[#faf9f8] px-3 py-2">
              <p className="text-[10px] uppercase text-[#8a8886]">Outstanding</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(data.outstandingBalance)}
              </p>
            </div>
          </div>
          {data.isSettled ? (
            <p className="text-xs font-medium text-emerald-700">
              Settled / cleared
              {data.loan.settledAt
                ? ` · ${formatDate(String(data.loan.settledAt))}`
                : ''}
            </p>
          ) : null}
          {data.installments.length > 0 ? (
            <div className="max-h-[280px] overflow-auto rounded border border-[#e1dfdd]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                    <th className="px-3 py-2 font-semibold">Due amt</th>
                    <th className="px-3 py-2 font-semibold">Paid</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.installments.map((i) => (
                    <tr
                      key={i.installmentNumber}
                      className="border-t border-[#edebe9]"
                    >
                      <td className="px-3 py-2 font-mono">
                        {i.installmentNumber}
                      </td>
                      <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(i.amountDue)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatMoney(i.amountPaid)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#605e5c]">
              No repayment schedule yet — loan must be issued first.
            </p>
          )}
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          Close
        </button>
      </div>
    </Modal>
  );
}
