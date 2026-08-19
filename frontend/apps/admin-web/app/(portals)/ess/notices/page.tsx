'use client';

import { listEssNotices, type EssNotice } from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { Megaphone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssNoticesPage() {
  const [rows, setRows] = useState<EssNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssNotices());
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
      title="Notices"
      description="Messages queued to your email or phone (leave, loans, payroll). A company bulletin board is not built yet — this is not a public announcement CMS."
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
          icon={<Megaphone className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Megaphone className="h-4 w-4" />}
                title="No messages yet"
                description="System notices sent to your email or phone appear here."
              />
            </div>
          ) : (
            <DataTable
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No notices"
              columns={[
                {
                  key: 'createdAt',
                  label: 'When',
                  render: (r) => formatDate(r.createdAt),
                },
                {
                  key: 'templateCode',
                  label: 'Type',
                  render: (r) => (
                    <span className="font-mono text-xs">{r.templateCode}</span>
                  ),
                },
                {
                  key: 'channel',
                  label: 'Channel',
                  render: (r) => <span className="text-xs">{r.channel}</span>,
                },
                {
                  key: 'subject',
                  label: 'Subject',
                  render: (r) => r.subject ?? r.body.slice(0, 80),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
