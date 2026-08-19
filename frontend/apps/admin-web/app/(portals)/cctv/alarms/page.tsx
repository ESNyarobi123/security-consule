'use client';

import {
  getCctvAlarmMonitor,
  type CctvAlarmMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvAlarmsPage() {
  const [pack, setPack] = useState<CctvAlarmMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvAlarmMonitor());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#605e5c]">
          HIGH/CRITICAL FieldAlerts, guard panic, parking gate alarms, and
          failed camera events. Escalate on{' '}
          <Link href="/branch/alerts" className="font-semibold text-[#0078d4]">
            /branch/alerts
          </Link>
          . No separate Alarm table.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <h2 className="mb-2 text-sm font-semibold">Field alarms</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.fieldAlarms ?? []}
        emptyMessage="No open field alarms"
        columns={[
          { key: 'alertType', label: 'Type' },
          { key: 'siteCode', label: 'Site' },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          { key: 'escalationStage', label: 'Stage' },
          { key: 'message', label: 'Message' },
          {
            key: 'createdAt',
            label: 'Raised',
            render: (r) => formatWhen(r.createdAt),
          },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Failed camera events</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.failedCameraEvents ?? []}
        emptyMessage="No FAILED CCTV_EVENT rows"
        columns={[
          { key: 'deviceId', label: 'Device' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          { key: 'error', label: 'Error' },
          {
            key: 'receivedAt',
            label: 'When',
            render: (r) => formatWhen(r.receivedAt),
          },
        ]}
      />
    </div>
  );
}
