'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { listEssApprovals, type EssApprovalItem } from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { ListChecks, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssApprovalsPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canAct = can(session, 'approvals.act');
  const [rows, setRows] = useState<EssApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssApprovals());
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
      title="Approvals"
      description="Status of workflows you started. If you hold approvals.act, pending items waiting on your role are listed — decide on the Approvals queue so you cannot approve your own request."
      actions={
        <div className="flex flex-wrap gap-2">
          {canAct ? (
            <Link href="/approvals" className={btnSecondary}>
              Open approvals queue
            </Link>
          ) : null}
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
        </div>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<ListChecks className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<ListChecks className="h-4 w-4" />}
                title="No approval items"
                description="Leave, loan, petty cash, and movement workflows you start appear here."
              />
            </div>
          ) : (
            <DataTable
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No approvals"
              columns={[
                {
                  key: 'mine',
                  label: 'Whose',
                  render: (r) => (
                    <span className="text-xs">
                      {r.mine ? 'Submitted by me' : 'Waiting on me'}
                    </span>
                  ),
                },
                { key: 'resourceType', label: 'Type' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: 'currentStepName',
                  label: 'Step',
                  render: (r) => r.currentStepName ?? '—',
                },
                {
                  key: 'requiredRole',
                  label: 'Role',
                  render: (r) => r.requiredRole ?? '—',
                },
                {
                  key: 'createdAt',
                  label: 'Started',
                  render: (r) => formatDate(r.createdAt),
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
