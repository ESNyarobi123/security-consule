'use client';

import {
  listViolations,
  type ParkingOpsViolation,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type ViolationRow = {
  id: string;
  plateNumber: string;
  violationType: string;
  description: string;
  recordedAt: string;
  siteId: string;
};

function toRow(v: ParkingOpsViolation): ViolationRow {
  return {
    id: v.id,
    plateNumber: v.plateNumber,
    violationType: v.violationType,
    description: v.description ?? '—',
    recordedAt: v.recordedAt,
    siteId: v.siteId,
  };
}

export default function ViolationsPage() {
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const violations = await listViolations();
      setRows(violations.map(toRow));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load violations',
      );
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
        title="Violations"
        description="Recorded parking violations"
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
        emptyMessage="No violations"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          {
            key: 'violationType',
            label: 'Type',
            render: (row) => <StatusBadge status={row.violationType} />,
          },
          { key: 'description', label: 'Description' },
          { key: 'recordedAt', label: 'Recorded' },
          { key: 'siteId', label: 'Site' },
        ]}
      />
    </>
  );
}
