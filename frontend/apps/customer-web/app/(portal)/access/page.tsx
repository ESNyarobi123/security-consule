'use client';

import {
  listCustomerAccessEmployees,
  type AccessEmployee,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function AccessPage() {
  const [rows, setRows] = useState<AccessEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerAccessEmployees());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
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
        title="Access"
        description="Your employees registered for site access control"
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
        emptyMessage="No access employees"
        columns={[
          { key: 'employeeNumber', label: 'Emp #' },
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'department', label: 'Department' },
          { key: 'accessCardRef', label: 'Card ref' },
          {
            key: 'isActive',
            label: 'Status',
            render: (row) => (
              <StatusBadge status={row.isActive ? 'ACTIVE' : 'SUSPENDED'} />
            ),
          },
        ]}
      />
    </>
  );
}
