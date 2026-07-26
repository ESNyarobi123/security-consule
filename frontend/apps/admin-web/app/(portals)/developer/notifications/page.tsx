'use client';

import {
  listNotifications,
  type NotificationRow,
} from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { Bell, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

export default function DeveloperNotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DeveloperShell
      title="Notifications"
      description="Outbound notification delivery queue (SMS, email, push)."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="p-4">
            <PanelEmpty
              icon={<Bell className="h-4 w-4" />}
              title="No notifications"
              description="Nothing in the delivery queue yet."
            />
          </div>
        ) : (
          <DataTable<NotificationRow>
            keyField="id"
            rows={rows}
            emptyMessage="No notifications"
            columns={[
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: 'channel',
                label: 'Channel',
                render: (row) => (
                  <span className="text-xs uppercase tracking-wide text-[#605e5c]">
                    {row.channel}
                  </span>
                ),
              },
              {
                key: 'recipient',
                label: 'Recipient',
                render: (row) => (
                  <span className="font-mono text-sm">{row.recipient}</span>
                ),
              },
              {
                key: 'templateCode',
                label: 'Template',
                render: (row) => (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {row.templateCode}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Created',
                render: (row) => (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
          />
        )}
      </GlassCard>
    </DeveloperShell>
  );
}
