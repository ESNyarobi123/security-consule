'use client';

import {
  actOnApproval,
  listApprovalInstances,
  type ApprovalInstance,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
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
  CheckCircle2,
  Clock,
  ListChecks,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Filter = 'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

export default function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalInstance | null>(
    null,
  );
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);
  const user = getSessionUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listApprovalInstances());
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
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.status === 'PENDING') pending += 1;
      else if (r.status === 'APPROVED') approved += 1;
      else if (r.status === 'REJECTED') rejected += 1;
    }
    return { pending, approved, rejected, total: rows.length };
  }, [rows]);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      PENDING: stats.pending,
      APPROVED: stats.approved,
      REJECTED: stats.rejected,
      ALL: stats.total,
    }),
    [stats],
  );

  const visible = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function act(
    id: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) {
    setError(null);
    setActing(true);
    try {
      await actOnApproval(id, {
        decision,
        remarks:
          decision === 'REJECT'
            ? note?.trim() || 'Rejected from admin queue'
            : undefined,
      });
      setRejectTarget(null);
      setRemarks('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Creator ≠ approver — the backend enforces CREATOR_CANNOT_APPROVE on every decision."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={stats.pending}
          hint="Awaiting a decision"
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          hint="Cleared through the queue"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          hint="Declined with remarks"
          icon={<XCircle className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="Total"
          value={stats.total}
          hint="All approval instances"
          icon={<ListChecks className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8">
        <SectionTitle>Approval queue</SectionTitle>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-[#0078d4] text-white shadow-sm'
                    : 'border border-[#e1dfdd] bg-white text-[#323130] hover:bg-[#f3f2f1]'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active
                      ? 'bg-white/25 text-white'
                      : 'bg-[#f3f2f1] text-[#605e5c]'
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <DataTable
          loading={loading}
          keyField="id"
          rows={visible}
          emptyMessage="No approval instances for this filter"
          columns={[
            { key: 'resourceType', label: 'Type' },
            {
              key: 'resourceId',
              label: 'Resource',
              render: (r) => (
                <span className="font-mono text-xs text-[#605e5c]">
                  {r.resourceId.slice(0, 8)}…
                </span>
              ),
            },
            {
              key: 'currentStepOrder',
              label: 'Step',
              render: (r) => (
                <span className="text-[#605e5c]">#{r.currentStepOrder}</span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'createdBy',
              label: 'Created by',
              render: (r) =>
                user && r.createdBy === user.id ? (
                  <span className="font-medium text-[#1b1a19]">You</span>
                ) : (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {r.createdBy.slice(0, 8)}…
                  </span>
                ),
            },
            {
              key: 'createdAt',
              label: 'When',
              render: (r) => (
                <span className="text-[#605e5c]">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              ),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => {
                if (r.status !== 'PENDING')
                  return <span className="text-[#a19f9d]">—</span>;
                if (user && r.createdBy === user.id) {
                  return (
                    <span className="text-xs text-[#a19f9d]">
                      You created this
                    </span>
                  );
                }
                return (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#107c10] hover:underline disabled:opacity-50"
                      onClick={() => void act(r.id, 'APPROVE')}
                      disabled={acting}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
                      onClick={() => {
                        setRemarks('');
                        setRejectTarget(r);
                      }}
                      disabled={acting}
                    >
                      Reject
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {rejectTarget ? (
        <Modal
          title="Reject approval"
          description={`${rejectTarget.resourceType} · ${rejectTarget.resourceId.slice(
            0,
            8,
          )}…`}
          onClose={() => {
            setRejectTarget(null);
            setRemarks('');
          }}
        >
          <label className="block text-sm font-medium text-[#323130]">
            Remarks
            <input
              className={inputCls}
              value={remarks}
              autoFocus
              placeholder="Reason for rejection (optional)"
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-[#605e5c]">
            Left blank, this records “Rejected from admin queue”.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setRejectTarget(null);
                setRemarks('');
              }}
              disabled={acting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void act(rejectTarget.id, 'REJECT', remarks)}
              disabled={acting}
            >
              {acting ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
