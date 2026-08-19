'use client';

import {
  getCctvParkingMonitor,
  type CctvParkingMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvParkingPage() {
  const [pack, setPack] = useState<CctvParkingMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvParkingMonitor());
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
          Occupied {pack?.occupancy.occupied ?? '—'}/
          {pack?.occupancy.spacesActive ?? '—'}
          {pack?.occupancy.utilizationPct != null
            ? ` (${pack.occupancy.utilizationPct}%)`
            : ''}
          . Issue / bill / approve stays parking-web.
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
      <h2 className="mb-2 text-sm font-semibold">Entries (24h)</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.entries ?? []}
        emptyMessage="No parking entries in the last 24 hours"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          { key: 'siteCode', label: 'Site' },
          { key: 'direction', label: 'Dir' },
          {
            key: 'decision',
            label: 'Decision',
            render: (r) => <StatusBadge status={r.decision} />,
          },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
          },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Open violations</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.openViolations ?? []}
        emptyMessage="No open violations"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          { key: 'siteCode', label: 'Site' },
          { key: 'violationType', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Parking patrol notes</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.patrolObservations ?? []}
        emptyMessage="No parking patrol observations"
        columns={[
          { key: 'parkingArea', label: 'Area' },
          { key: 'siteCode', label: 'Site' },
          { key: 'observationType', label: 'Type' },
          { key: 'plateNumber', label: 'Plate' },
          {
            key: 'inspectedAt',
            label: 'When',
            render: (r) => formatWhen(r.inspectedAt),
          },
        ]}
      />
      {pack?.notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{pack.notes[0]}</p>
      ) : null}
    </div>
  );
}
