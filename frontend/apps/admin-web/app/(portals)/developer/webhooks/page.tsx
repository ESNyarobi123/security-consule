'use client';

import {
  listWebhookInbox,
  replayWebhookInbox,
  type WebhookInboxEntry,
} from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { Inbox, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

const WEBHOOK_STATUSES = [
  'ALL',
  'FAILED',
  'DLQ',
  'RECEIVED',
  'PROCESSED',
] as const;

type WebhookStatusFilter = (typeof WEBHOOK_STATUSES)[number];

const filterSelectCls =
  'rounded-md border border-[#8a8886] bg-white px-2.5 py-1.5 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]';

export default function DeveloperWebhooksPage() {
  const [inbox, setInbox] = useState<WebhookInboxEntry[]>([]);
  const [status, setStatus] = useState<WebhookStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInbox(
        await listWebhookInbox(status === 'ALL' ? undefined : status),
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
      await replayWebhookInbox(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DeveloperShell
      title="Webhook inbox"
      description="Inbound payment and ANPR webhooks. Replay FAILED / DLQ only."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Status
            <select
              className={filterSelectCls}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as WebhookStatusFilter)
              }
            >
              {WEBHOOK_STATUSES.map((s) => (
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
        {inbox.length === 0 && !loading ? (
          <div className="p-4">
            <PanelEmpty
              icon={<Inbox className="h-4 w-4" />}
              title="Inbox empty"
              description="No webhook events match this filter."
            />
          </div>
        ) : (
          <DataTable<WebhookInboxEntry>
            keyField="id"
            rows={inbox}
            emptyMessage="Inbox empty"
            columns={[
              {
                key: 'provider',
                label: 'Provider',
                render: (row) => (
                  <span className="font-mono text-sm">{row.provider}</span>
                ),
              },
              {
                key: 'eventType',
                label: 'Event',
                render: (row) => (
                  <span className="text-sm">{row.eventType}</span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: 'signatureValid',
                label: 'Sig',
                render: (row) => (
                  <span
                    className={`text-xs font-medium ${
                      row.signatureValid ? 'text-[#107c10]' : 'text-rose-700'
                    }`}
                  >
                    {row.signatureValid ? 'Valid' : 'Invalid'}
                  </span>
                ),
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
                key: 'createdAt',
                label: 'Created',
                render: (row) => (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {new Date(row.createdAt).toLocaleString()}
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
                      (row.status !== 'FAILED' && row.status !== 'DLQ')
                    }
                    onClick={() => void onReplay(row.id)}
                  >
                    Replay
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
