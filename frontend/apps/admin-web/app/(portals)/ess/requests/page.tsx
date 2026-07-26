'use client';

import { listEssRequests, type EssRequestItem } from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { ClipboardList, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssRequestsPage() {
  const [rows, setRows] = useState<EssRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssRequests());
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
      title="Requests"
      description="Your leave, loan, and movement status only — approvals stay with HR."
      actions={
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
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<ClipboardList className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login. Contact HR to see your request status."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<ClipboardList className="h-4 w-4" />}
                title="No requests yet"
                description="Leave, loan, and movement items you submit appear here with their status."
              />
            </div>
          ) : (
            <DataTable<EssRequestItem>
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No requests"
              columns={[
                {
                  key: 'kind',
                  label: 'Kind',
                  render: (r) => (
                    <span className="font-mono text-[11px] uppercase text-[#605e5c]">
                      {r.kind}
                    </span>
                  ),
                },
                {
                  key: 'title',
                  label: 'Title',
                  render: (r) =>
                    r.href ? (
                      <Link
                        href={r.href}
                        className="text-sm font-medium text-[#0078d4] hover:underline"
                      >
                        {r.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-[#323130]">{r.title}</span>
                    ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  render: (r) => formatDate(r.createdAt),
                },
                {
                  key: 'detail',
                  label: 'Detail',
                  render: (r) => (
                    <span
                      className="max-w-[200px] truncate text-xs text-[#605e5c]"
                      title={r.detail ?? undefined}
                    >
                      {r.detail ?? '—'}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
