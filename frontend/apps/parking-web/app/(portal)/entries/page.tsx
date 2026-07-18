'use client';

import {
  listEntries,
  type ParkingOpsEntry,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type EntryRow = {
  id: string;
  plateNumber: string;
  direction: string;
  decision: string;
  recordedAt: string;
  siteId: string;
};

function toRow(e: ParkingOpsEntry): EntryRow {
  return {
    id: e.id,
    plateNumber: e.plateNumber,
    direction: e.direction,
    decision: e.decision,
    recordedAt: e.recordedAt,
    siteId: e.siteId,
  };
}

export default function EntriesPage() {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await listEntries();
      setRows(entries.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Entries"
        description="Gate entry and exit records"
      />
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No entries"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          { key: 'direction', label: 'Direction' },
          {
            key: 'decision',
            label: 'Decision',
            render: (row) => <StatusBadge status={row.decision} />,
          },
          { key: 'recordedAt', label: 'Time' },
          { key: 'siteId', label: 'Site' },
        ]}
      />
    </>
  );
}
