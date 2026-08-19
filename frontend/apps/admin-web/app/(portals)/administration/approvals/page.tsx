'use client';

import {
  listApprovalInstances,
  listApprovalWorkflows,
  type ApprovalInstance,
  type ApprovalWorkflow,
} from '@pssms/api-client';
import { GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError } from '../_components/shared';

export default function AdministrationApprovalsPage() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [pending, setPending] = useState<ApprovalInstance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, inst] = await Promise.all([
        listApprovalWorkflows(),
        listApprovalInstances(),
      ]);
      setWorkflows(w.filter((x) => x.isActive));
      setPending(inst.filter((i) => i.status === 'PENDING'));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a19]">
            Document approvals
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
            Shared approvals engine — not a second matrix. Act on items from the
            Approvals queue so creator ≠ approver stays enforced.
          </p>
        </div>
        <Link href="/approvals" className={btnSecondary}>
          Open queue
        </Link>
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">Active workflows</h2>
        {loading ? (
          <p className="mt-2 text-sm text-[#605e5c]">Loading…</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#edebe9] text-sm">
            {workflows.map((w) => (
              <li key={w.id} className="py-2">
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-[#605e5c]">
                  {w.code}
                  {w.steps.length
                    ? ` · ${w.steps.map((s) => s.requiredRole).join(' → ')}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">Pending in queue</h2>
        {pending.length === 0 && !loading ? (
          <p className="mt-2 text-sm text-[#605e5c]">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#edebe9] text-sm">
            {pending.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-medium">{i.resourceType}</span>
                  <span className="text-[#605e5c]">
                    {' '}
                    · {i.currentStepName ?? `step ${i.currentStepOrder}`}
                  </span>
                </span>
                <StatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
