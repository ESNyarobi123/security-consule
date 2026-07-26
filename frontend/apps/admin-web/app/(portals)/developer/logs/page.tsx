'use client';

import {
  listIntegrationLogs,
  type IntegrationRequestLog,
} from '@pssms/api-client';
import { DataTable, GlassCard, btnSecondary } from '@pssms/ui';
import { RefreshCw, ScrollText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

const filterInputCls =
  'rounded-md border border-[#8a8886] bg-white px-2.5 py-1.5 font-mono text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]';

export default function DeveloperLogsPage() {
  const [rows, setRows] = useState<IntegrationRequestLog[]>([]);
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await listIntegrationLogs(
          provider.trim() || undefined,
          100,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DeveloperShell
      title="Integration logs"
      description="Outbound/inbound request log (provider, status, duration)."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Provider
            <input
              type="text"
              value={provider}
              placeholder="all"
              onChange={(e) => setProvider(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void refresh();
              }}
              className={filterInputCls}
            />
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
        {rows.length === 0 && !loading ? (
          <div className="p-4">
            <PanelEmpty
              icon={<ScrollText className="h-4 w-4" />}
              title="No logs"
              description="No integration request logs yet."
            />
          </div>
        ) : (
          <DataTable<IntegrationRequestLog>
            keyField="id"
            rows={rows}
            emptyMessage="No logs"
            columns={[
              {
                key: 'createdAt',
                label: 'When',
                render: (row) => (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'provider',
                label: 'Provider',
                render: (row) => (
                  <span className="font-mono text-sm">{row.provider}</span>
                ),
              },
              {
                key: 'direction',
                label: 'Dir',
                render: (row) => (
                  <span className="text-[11px] uppercase tracking-wide text-[#605e5c]">
                    {row.direction}
                  </span>
                ),
              },
              {
                key: 'statusCode',
                label: 'HTTP',
                render: (row) => (
                  <span
                    className={`font-mono text-xs ${
                      row.statusCode != null && row.statusCode >= 400
                        ? 'text-rose-700'
                        : 'text-[#323130]'
                    }`}
                  >
                    {row.statusCode ?? '—'}
                  </span>
                ),
              },
              {
                key: 'durationMs',
                label: 'ms',
                render: (row) => (
                  <span className="font-mono text-xs text-[#605e5c]">
                    {row.durationMs ?? '—'}
                  </span>
                ),
              },
              {
                key: 'correlationId',
                label: 'Correlation',
                render: (row) => (
                  <span className="max-w-[140px] truncate font-mono text-[11px] text-[#605e5c]">
                    {row.correlationId ?? '—'}
                  </span>
                ),
              },
              {
                key: 'summary',
                label: 'Summary',
                render: (row) => (
                  <span
                    className="max-w-[280px] truncate text-xs text-[#323130]"
                    title={row.summary ?? undefined}
                  >
                    {row.summary ?? '—'}
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
