'use client';

import {
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  type ParkingPermit,
  type ParkingVehicle,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function ParkingPage() {
  const [vehicles, setVehicles] = useState<ParkingVehicle[]>([]);
  const [permits, setPermits] = useState<ParkingPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, p] = await Promise.all([
        listCustomerParkingVehicles(),
        listCustomerParkingPermits(),
      ]);
      setVehicles(v);
      setPermits(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parking');
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
        title="Parking"
        description="Registered vehicles and active permits"
      />
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Vehicles
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={vehicles}
        emptyMessage="No vehicles registered"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          { key: 'vehicleType', label: 'Type' },
          { key: 'make', label: 'Make' },
          { key: 'model', label: 'Model' },
          { key: 'ownerName', label: 'Owner' },
          {
            key: 'isActive',
            label: 'Status',
            render: (row) => (
              <StatusBadge status={row.isActive ? 'ACTIVE' : 'SUSPENDED'} />
            ),
          },
        ]}
      />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Permits
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={permits}
        emptyMessage="No parking permits"
        columns={[
          { key: 'permitNumber', label: 'Permit #' },
          { key: 'permitType', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'vehicleId', label: 'Vehicle ID' },
          { key: 'validFrom', label: 'From' },
          { key: 'validUntil', label: 'Until' },
        ]}
      />
    </>
  );
}
