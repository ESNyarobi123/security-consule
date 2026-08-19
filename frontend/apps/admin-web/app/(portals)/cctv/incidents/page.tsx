'use client';

import {
  getCctvIncidentMonitor,
  type CctvIncidentMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvIncidentsPage() {
  const [pack, setPack] = useState<CctvIncidentMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvIncidentMonitor());
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
          Open / investigating incidents (read-only). Create from Alerts (28-A).
          Close stays{' '}
          <Link href="/branch/incidents" className="font-semibold text-[#0078d4]">
            /branch/incidents
          </Link>
          . This portal does not grant incidents.manage to CCTV Operator.
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
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.rows ?? []}
        emptyMessage="No open incidents"
        columns={[
          { key: 'incidentNumber', label: 'Number' },
          { key: 'title', label: 'Title' },
          { key: 'siteCode', label: 'Site' },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'occurredAt',
            label: 'Occurred',
            render: (r) => formatWhen(r.occurredAt),
          },
        ]}
      />
      {pack?.notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{pack.notes[0]}</p>
      ) : null}
    </div>
  );
}
