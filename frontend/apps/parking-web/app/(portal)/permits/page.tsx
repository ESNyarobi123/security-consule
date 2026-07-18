'use client';

import {
  approvePermit,
  listPermits,
  type ParkingOpsPermit,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type PermitRow = {
  id: string;
  permitNumber: string;
  permitType: string;
  status: string;
  vehicleId: string;
  siteId: string;
  validFrom: string;
  validUntil: string;
};

function toRow(p: ParkingOpsPermit): PermitRow {
  return {
    id: p.id,
    permitNumber: p.permitNumber,
    permitType: p.permitType,
    status: p.status,
    vehicleId: p.vehicleId,
    siteId: p.siteId,
    validFrom: p.validFrom,
    validUntil: p.validUntil,
  };
}

export default function PermitsPage() {
  const [rows, setRows] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const permits = await listPermits();
      setRows(permits.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await approvePermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Permits"
        description="Approve pending permits and review active ones"
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
        emptyMessage="No permits"
        columns={[
          { key: 'permitNumber', label: 'Permit #' },
          { key: 'permitType', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'vehicleId', label: 'Vehicle' },
          { key: 'siteId', label: 'Site' },
          { key: 'validFrom', label: 'Valid from' },
          { key: 'validUntil', label: 'Valid until' },
          {
            key: 'id',
            label: 'Actions',
            render: (row) =>
              row.status === 'PENDING' ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void onApprove(row.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {busyId === row.id ? 'Approving…' : 'Approve'}
                </button>
              ) : (
                <span className="text-slate-500">—</span>
              ),
          },
        ]}
      />
    </>
  );
}
