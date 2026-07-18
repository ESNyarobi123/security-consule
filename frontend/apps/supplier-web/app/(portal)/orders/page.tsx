'use client';

import {
  listSupplierOrders,
  type SupplierPurchaseOrder,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type OrderRow = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  expectedDelivery: string;
  createdAt: string;
};

function toRow(po: SupplierPurchaseOrder): OrderRow {
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    totalAmount: po.totalAmount,
    currency: po.currency,
    expectedDelivery: po.expectedDelivery ?? '—',
    createdAt: po.createdAt,
  };
}

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = await listSupplierOrders();
      setRows(orders.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
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
        title="Orders"
        description="Purchase orders issued to your company"
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
        emptyMessage="No purchase orders"
        columns={[
          { key: 'poNumber', label: 'PO number' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'totalAmount', label: 'Total' },
          { key: 'currency', label: 'Currency' },
          { key: 'expectedDelivery', label: 'Expected delivery' },
          { key: 'createdAt', label: 'Created' },
        ]}
      />
    </>
  );
}
