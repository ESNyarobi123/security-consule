'use client';

import {
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  type ParkingPermit,
  type ParkingVehicle,
} from '@pssms/api-client';
import { Car, RefreshCw, Ticket } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

export default function ParkingPage() {
  const [vehicles, setVehicles] = useState<ParkingVehicle[]>([]);
  const [permits, setPermits] = useState<ParkingPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'vehicles' | 'permits'>('vehicles');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const activeVehicles = vehicles.filter((v) => v.isActive).length;
  const activePermits = permits.filter((p) =>
    p.status.toUpperCase().includes('ACTIVE'),
  ).length;

  const vehicleById = useMemo(() => {
    const m = new Map<string, ParkingVehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const filters =
    tab === 'vehicles'
      ? [
          { id: 'ALL', label: 'All', count: vehicles.length },
          {
            id: 'ACTIVE',
            label: 'Active',
            count: activeVehicles,
          },
          {
            id: 'INACTIVE',
            label: 'Inactive',
            count: vehicles.length - activeVehicles,
          },
        ]
      : [
          { id: 'ALL', label: 'All', count: permits.length },
          ...[...new Set(permits.map((p) => p.status.toUpperCase()))].map(
            (s) => ({
              id: s,
              label: s.replace(/_/g, ' '),
              count: permits.filter((p) => p.status.toUpperCase() === s).length,
            }),
          ),
        ];

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter === 'ACTIVE' && !v.isActive) return false;
      if (statusFilter === 'INACTIVE' && v.isActive) return false;
      if (!q) return true;
      return (
        v.plateNumber.toLowerCase().includes(q) ||
        (v.make ?? '').toLowerCase().includes(q) ||
        (v.model ?? '').toLowerCase().includes(q) ||
        (v.ownerName ?? '').toLowerCase().includes(q) ||
        v.vehicleType.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter]);

  const filteredPermits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permits.filter((p) => {
      if (statusFilter !== 'ALL' && p.status.toUpperCase() !== statusFilter) {
        return false;
      }
      const plate =
        p.plateNumber ?? vehicleById.get(p.vehicleId)?.plateNumber ?? '';
      if (!q) return true;
      return (
        p.permitNumber.toLowerCase().includes(q) ||
        p.permitType.toLowerCase().includes(q) ||
        plate.toLowerCase().includes(q) ||
        (p.siteCode ?? '').toLowerCase().includes(q) ||
        (p.siteName ?? '').toLowerCase().includes(q)
      );
    });
  }, [permits, search, statusFilter, vehicleById]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8"
        title="Parking"
        subtitle="Registered vehicles and permits for your organisation."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat label="Vehicles" value={loading ? '—' : vehicles.length} tone="sky" />
        <PortalStat label="Active vehicles" value={loading ? '—' : activeVehicles} tone="teal" />
        <PortalStat label="Active permits" value={loading ? '—' : activePermits} tone="violet" />
      </div>

      <div className="mb-3 flex gap-1 rounded-xl border border-[#e1dfdd] bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => {
            setTab('vehicles');
            setStatusFilter('ALL');
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            tab === 'vehicles'
              ? 'bg-[#0078d4] text-white'
              : 'text-[#605e5c] hover:bg-[#f3f2f1]'
          }`}
        >
          <Car className="h-3.5 w-3.5" /> Vehicles
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('permits');
            setStatusFilter('ALL');
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            tab === 'permits'
              ? 'bg-[#0078d4] text-white'
              : 'text-[#605e5c] hover:bg-[#f3f2f1]'
          }`}
        >
          <Ticket className="h-3.5 w-3.5" /> Permits
        </button>
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          tab === 'vehicles' ? 'Search plate, make, owner…' : 'Search permit #, plate…'
        }
        filters={filters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {tab === 'vehicles' ? (
        loading && vehicles.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#edebe9]" />
            ))}
          </div>
        ) : filteredVehicles.length === 0 ? (
          <PortalEmpty
            title="No vehicles"
            description="Register vehicles with HIGHLINK parking ops to see them here."
            icon={<Car className="h-4 w-4" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((v) => {
              const related = permits.filter((p) => p.vehicleId === v.id).length;
              return (
                <article
                  key={v.id}
                  className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-lg font-bold tracking-wide text-[#1b1a19]">
                        {v.plateNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-[#605e5c]">
                        {[v.make, v.model, v.color].filter(Boolean).join(' · ') ||
                          v.vehicleType}
                      </p>
                    </div>
                    <StatusPill status={v.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                  <p className="mt-3 text-xs text-[#323130]">
                    Owner: {v.ownerName ?? '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8886]">
                    {v.vehicleType.replace(/_/g, ' ')}
                    {related ? ` · ${related} permit${related === 1 ? '' : 's'}` : ''}
                  </p>
                </article>
              );
            })}
          </div>
        )
      ) : loading && permits.length === 0 ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[#edebe9]" />
      ) : filteredPermits.length === 0 ? (
        <PortalEmpty
          title="No permits"
          description="Active parking permits for your vehicles will list here."
          icon={<Ticket className="h-4 w-4" />}
        />
      ) : (
        <PortalPanel title="Permits">
          <ul className="divide-y divide-[#edebe9]">
            {filteredPermits.map((p) => {
              const veh = vehicleById.get(p.vehicleId);
              const plate = p.plateNumber ?? veh?.plateNumber;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-[#1b1a19]">
                      {p.permitNumber}
                    </p>
                    <p className="text-xs text-[#605e5c]">
                      {p.permitType.replace(/_/g, ' ')}
                      {plate ? ` · ${plate}` : ''}
                      {p.siteCode || p.siteName
                        ? ` · ${[p.siteCode, p.siteName].filter(Boolean).join(' ')}`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8a8886]">
                      {formatDate(p.validFrom)} → {formatDate(p.validUntil)}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              );
            })}
          </ul>
        </PortalPanel>
      )}

      <PortalDeferral note="ANPR events and blacklist actions are handled by HIGHLINK ops — this portal shows your registered fleet and permits only." />
    </div>
  );
}
