'use client';

import {
  listIntegrationOutbox,
  replayIntegrationOutbox,
  type IntegrationOutboxEntry,
} from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

const OUTBOX_STATUSES = ['ALL', 'PENDING', 'FAILED'] as const;
type OutboxStatusFilter = (typeof OUTBOX_STATUSES)[number];

const filterSelectCls =
  'rounded-md border border-[#8a8886] bg-white px-2.5 py-1.5 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]';

export default function DeveloperOutboxPage() {
  const [outbox, setOutbox] = useState<IntegrationOutboxEntry[]>([]);
  const [status, setStatus] = useState<OutboxStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOutbox(
        await listIntegrationOutbox(status === 'ALL' ? undefined : status),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onReplay = async (id: string) => {
    setBusyId(id);
    try {
      await replayIntegrationOutbox(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DeveloperShell
      title="Integration outbox"
      description="Pending and failed outbound events. Requeue PENDING / FAILED only."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Status
            <select
              className={filterSelectCls}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as OutboxStatusFilter)
              }
            >
              {OUTBOX_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
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
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {outbox.length === 0 && !loading ? (
          <div className="p-4">
            <PanelEmpty
              icon={<Send className="h-4 w-4" />}
              title="Outbox clear"
              description="No outbox rows match this filter."
            />
          </div>
        ) : (
          <DataTable<IntegrationOutboxEntry>
            keyField="id"
            rows={outbox}
            emptyMessage="No pending or failed outbox rows"
            columns={[
              {
                key: 'eventType',
                label: 'Event',
                render: (row) => (
                  <span className="font-mono text-sm">{row.eventType}</span>
                ),
              },
              {
                key: 'aggregateType',
                label: 'Aggregate',
                render: (row) => (
                  <span className="text-xs text-[#605e5c]">
                    {row.aggregateType}:{row.aggregateId.slice(0, 8)}…
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: 'retryCount',
                label: 'Retries',
                render: (row) => (
                  <span className="text-xs">{row.retryCount}</span>
                ),
              },
              {
                key: 'errorMessage',
                label: 'Error',
                render: (row) => (
                  <span
                    className="max-w-[220px] truncate text-xs text-rose-700"
                    title={row.errorMessage ?? undefined}
                  >
                    {row.errorMessage ?? '—'}
                  </span>
                ),
              },
              {
                key: 'id',
                label: '',
                render: (row) => (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={
                      busyId === row.id ||
                      (row.status !== 'PENDING' && row.status !== 'FAILED')
                    }
                    onClick={() => void onReplay(row.id)}
                  >
                    Requeue
                  </button>
                ),
              },
            ]}
          />
        )}
      </GlassCard>
    </DeveloperShell>
  );
}
