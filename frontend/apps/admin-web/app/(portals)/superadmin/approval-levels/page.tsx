'use client';

import {
  listApprovalWorkflows,
  type ApprovalWorkflow,
} from '@pssms/api-client';
import { GlassCard } from '@pssms/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatApiError } from '../_components/shared';

export default function SuperAdminApprovalLevelsPage() {
  const [rows, setRows] = useState<ApprovalWorkflow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listApprovalWorkflows()
      .then(setRows)
      .catch((err) => setError(formatApiError(err)));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Approval levels</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
          Current workflow definitions and required roles. Super Admin reviews
          the matrix here; acting on instances stays on the shared approvals
          queue. Workflow mutate (SysAdmin→CMD matrix editor) is deferred.
        </p>
        <Link href="/approvals" className="mt-2 inline-block text-sm text-[#0078d4]">
          Open approvals queue
        </Link>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map((wf) => (
          <GlassCard key={wf.id} glow="none" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-[#1b1a19]">{wf.name}</h2>
                <p className="font-mono text-xs text-[#605e5c]">
                  {wf.code} · v{wf.version}
                  {wf.isActive ? '' : ' · inactive'}
                </p>
              </div>
              <span className="text-xs text-[#605e5c]">
                {wf.steps.length} steps
              </span>
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              {wf.steps.map((s) => (
                <li key={`${wf.id}-${s.stepOrder}`} className="flex gap-3">
                  <span className="w-6 tabular-nums text-[#605e5c]">
                    {s.stepOrder}.
                  </span>
                  <span className="font-medium">{s.name}</span>
                  <span className="font-mono text-xs text-[#0078d4]">
                    {s.requiredRole}
                  </span>
                  {s.amountThreshold != null ? (
                    <span className="text-xs text-[#605e5c]">
                      ≥ {s.amountThreshold}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </GlassCard>
        ))}
        {rows.length === 0 && !error ? (
          <p className="text-sm text-[#605e5c]">No workflow definitions.</p>
        ) : null}
      </div>
    </div>
  );
}
