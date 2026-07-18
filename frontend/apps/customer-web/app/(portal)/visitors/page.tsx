'use client';

import {
  listCustomerVisitors,
  type VisitorAppointment,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function VisitorsPage() {
  const [rows, setRows] = useState<VisitorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerVisitors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visitors');
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
        title="Visitors"
        description="Appointments at your gated sites"
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
        emptyMessage="No visitor appointments"
        columns={[
          { key: 'referenceNumber', label: 'Reference' },
          { key: 'visitorName', label: 'Visitor' },
          { key: 'hostName', label: 'Host' },
          { key: 'purpose', label: 'Purpose' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'validFrom', label: 'From' },
          { key: 'validUntil', label: 'Until' },
        ]}
      />
    </>
  );
}
