'use client';

import {
  listCustomerInvoices,
  type Invoice,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
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
        title="Invoices"
        description="Billing for your security services"
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
        emptyMessage="No invoices"
        columns={[
          { key: 'invoiceNumber', label: 'Invoice #' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: 'totalAmount',
            label: 'Total',
            render: (row) => String(row.totalAmount),
          },
          {
            key: 'amountPaid',
            label: 'Paid',
            render: (row) => String(row.amountPaid),
          },
          { key: 'currency', label: 'Currency' },
          { key: 'dueDate', label: 'Due' },
        ]}
      />
    </>
  );
}
