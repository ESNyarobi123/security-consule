'use client';

import {
  getBranchParkingMonitor,
  type BranchParkingMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime } from '../_components/shared';

export default function BranchParkingPage() {
  const [pack, setPack] = useState<BranchParkingMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getBranchParkingMonitor());
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
    <BranchShell
      title="Parking operations"
      description="Read-only site parking board (entries, occupancy, open violations). Permits, billing, and ANPR decide stay parking-web — this portal does not grant parking.manage."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-sm text-[#605e5c]">
        Occupied {pack?.occupancy.occupied ?? '—'}/
        {pack?.occupancy.spacesActive ?? '—'}
        {pack?.occupancy.utilizationPct != null
          ? ` (${pack.occupancy.utilizationPct}%)`
          : ''}
        .
      </p>
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
            render: (r) => formatDateTime(r.recordedAt),
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
      {pack?.notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{pack.notes[0]}</p>
      ) : null}
    </BranchShell>
  );
}
