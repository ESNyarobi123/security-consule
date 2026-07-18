'use client';

import {
  listCustomerContracts,
  type Contract,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerContracts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
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
        title="Contracts"
        description="Service agreements for your sites"
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
        emptyMessage="No contracts"
        columns={[
          { key: 'contractNumber', label: 'Number' },
          { key: 'title', label: 'Title' },
          { key: 'serviceType', label: 'Service' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'monthlyFee', label: 'Monthly fee' },
          { key: 'currency', label: 'Currency' },
          { key: 'startDate', label: 'Start' },
          { key: 'endDate', label: 'End' },
        ]}
      />
    </>
  );
}
