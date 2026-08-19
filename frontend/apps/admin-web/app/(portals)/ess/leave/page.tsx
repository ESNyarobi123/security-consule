'use client';

import {
  applyEssLeave,
  listEssLeaveBalances,
  listEssLeaveRequests,
  listEssLeaveTypes,
  type EssLeaveBalance,
  type EssLeaveRequest,
  type EssLeaveType,
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
import { CalendarClock, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import { PanelEmpty, formatDate, isEssProfileMissing } from '../_components/shared';

export default function EssLeavePage() {
  const [types, setTypes] = useState<EssLeaveType[]>([]);
  const [requests, setRequests] = useState<EssLeaveRequest[]>([]);
  const [balances, setBalances] = useState<EssLeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const [leaveTypes, reqs, bal] = await Promise.all([
        listEssLeaveTypes(),
        listEssLeaveRequests(),
        listEssLeaveBalances(),
      ]);
      setTypes(leaveTypes);
      setRequests(reqs);
      setBalances(bal);
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setTypes([]);
        setRequests([]);
        setBalances([]);
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

  const leaveTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of types) map.set(t.id, t.name);
    return map;
  }, [types]);

  return (
    <EssShell
      title="Leave"
      description="Apply for leave and see your annual balance. Someone else must approve (creator ≠ approver)."
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
            disabled={missing || types.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            Apply leave
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
          icon={<CalendarClock className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login. Contact HR before applying for leave."
        />
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Leave balance {balances[0] ? `(${balances[0].year})` : ''} ·{' '}
              {types.length} types
            </h2>
            {types.length === 0 && !loading ? (
              <PanelEmpty
                icon={<CalendarClock className="h-4 w-4" />}
                title="No leave types"
                description="HR has not published leave categories yet."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((t) => {
                  const bal = balances.find((b) => b.leaveTypeId === t.id);
                  return (
                  <div
                    key={t.id}
                    className="rounded-lg border border-[#e1dfdd] bg-white px-3 py-2.5 shadow-sm"
                  >
                    <p className="text-sm font-medium text-[#1b1a19]">
                      {t.name}
                    </p>
                    <p className="font-mono text-[11px] text-[#605e5c]">
                      {t.code} · quota {t.annualQuotaDays} days
                    </p>
                    {bal ? (
                      <p className="mt-1 text-xs text-[#323130]">
                        Remaining {bal.remainingDays} · used {bal.usedDays}
                        {bal.pendingDays
                          ? ` · pending ${bal.pendingDays}`
                          : ''}{' '}
                        ({bal.year})
                      </p>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              My requests ({requests.length})
            </h2>
            <GlassCard className="!p-0 overflow-hidden">
              {requests.length === 0 && !loading ? (
                <div className="p-4">
                  <PanelEmpty
                    icon={<CalendarClock className="h-4 w-4" />}
                    title="No leave requests"
                    description="Apply for leave when a type is available."
                  />
                </div>
              ) : (
                <DataTable<EssLeaveRequest>
                  loading={loading}
                  keyField="id"
                  rows={requests}
                  emptyMessage="No leave requests"
                  columns={[
                    {
                      key: 'leaveTypeId',
                      label: 'Type',
                      render: (r) =>
                        leaveTypeName.get(r.leaveTypeId) ?? '—',
                    },
                    {
                      key: 'startDate',
                      label: 'From',
                      render: (r) => formatDate(r.startDate),
                    },
                    {
                      key: 'endDate',
                      label: 'To',
                      render: (r) => formatDate(r.endDate),
                    },
                    {
                      key: 'days',
                      label: 'Days',
                      render: (r) => (
                        <span className="text-xs">{r.days}</span>
                      ),
                    },
                    {
                      key: 'reason',
                      label: 'Reason',
                      render: (r) => (
                        <span
                          className="max-w-[180px] truncate text-xs text-[#605e5c]"
                          title={r.reason}
                        >
                          {r.reason}
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
          </section>
        </>
      )}

      {applyOpen ? (
        <ApplyLeaveModal
          types={types}
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

function ApplyLeaveModal({
  types,
  onClose,
  onCreated,
}: {
  types: EssLeaveType[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await applyEssLeave({
        leaveTypeId,
        startDate,
        endDate,
        days: Number(days),
        reason: reason.trim(),
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
      title="Apply for leave"
      description="Starts the leave-approval workflow for you only."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
            Leave type
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={inputCls}
              required
            >
              {types.length === 0 ? (
                <option value="">No leave types</option>
              ) : (
                types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Days
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
              required
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputCls} min-h-[72px]`}
            placeholder="At least 3 characters"
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
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting || types.length === 0}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
