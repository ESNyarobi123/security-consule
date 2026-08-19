'use client';

import {
  listApprovalInstances,
  listLeaveRequests,
  type ApprovalInstance,
  type LeaveRequest,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatApiError } from '../_components/shared';

export default function AdministrationRequestsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canAct = can(session, 'approvals.act');
  const canHr = can(session, 'hr.manage');
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inst, lv] = await Promise.all([
        canAct
          ? listApprovalInstances().catch(() => [] as ApprovalInstance[])
          : Promise.resolve([] as ApprovalInstance[]),
        canHr
          ? listLeaveRequests().catch(() => [] as LeaveRequest[])
          : Promise.resolve([] as LeaveRequest[]),
      ]);
      setInstances(inst.filter((i) => i.status === 'PENDING'));
      setLeave(lv.filter((r) => r.status === 'PENDING'));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canAct, canHr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">
          Internal requests
        </h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Office view of pending workflows. There is no separate correspondence
          inbox — leave, loans, petty cash, contracts, and IAM changes use the
          shared approvals engine (creator ≠ approver).
        </p>
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/approvals" className={btnSecondary}>
          Approvals queue
        </Link>
        <Link href="/ess/requests" className={btnSecondary}>
          My ESS requests
        </Link>
        {canHr ? (
          <Link href="/hr/leave" className={btnSecondary}>
            HR leave
          </Link>
        ) : null}
        {can(session, 'finance.manage') ? (
          <Link href="/finance/petty-cash" className={btnSecondary}>
            Petty cash
          </Link>
        ) : null}
      </div>

      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">Pending approval instances</h2>
        {!canAct ? (
          <p className="mt-2 text-sm text-[#605e5c]">
            Listing the company queue needs approvals.act (GM, Department Head,
            and designated approvers). Use My ESS for your own submissions.
          </p>
        ) : loading ? (
          <p className="mt-2 text-sm text-[#605e5c]">Loading…</p>
        ) : instances.length === 0 ? (
          <p className="mt-2 text-sm text-[#605e5c]">No pending instances.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#edebe9] text-sm">
            {instances.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{i.resourceType}</span>
                  <span className="text-[#605e5c]">
                    {' '}
                    · {i.currentStepName ?? `step ${i.currentStepOrder}`}
                    {i.requiredRole ? ` · ${i.requiredRole}` : ''}
                  </span>
                </span>
                <StatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {canHr ? (
        <GlassCard glow="none" className="p-4">
          <h2 className="text-sm font-semibold">Pending leave</h2>
          {leave.length === 0 ? (
            <p className="mt-2 text-sm text-[#605e5c]">No pending leave.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#edebe9] text-sm">
              {leave.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {r.employeeId.slice(0, 8)}…
                    <span className="text-[#605e5c]">
                      {' '}
                      · {r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}
                    </span>
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      ) : null}
    </div>
  );
}
