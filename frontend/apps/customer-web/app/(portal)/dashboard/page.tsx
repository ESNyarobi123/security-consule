'use client';

import {
  getCustomerMe,
  listCustomerAccessEmployees,
  listCustomerContracts,
  listCustomerInvoices,
  listCustomerParkingPermits,
  listCustomerParkingVehicles,
  listCustomerVisitors,
  type CustomerProfile,
} from '@pssms/api-client';
import { PageHeader } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type Counts = {
  contracts: number;
  invoices: number;
  visitors: number;
  access: number;
  vehicles: number;
  permits: number;
};

export default function DashboardPage() {
  const [me, setMe] = useState<CustomerProfile | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        profile,
        contracts,
        invoices,
        visitors,
        access,
        vehicles,
        permits,
      ] = await Promise.all([
        getCustomerMe(),
        listCustomerContracts(),
        listCustomerInvoices(),
        listCustomerVisitors(),
        listCustomerAccessEmployees(),
        listCustomerParkingVehicles(),
        listCustomerParkingPermits(),
      ]);
      setMe(profile);
      setCounts({
        contracts: contracts.length,
        invoices: invoices.length,
        visitors: visitors.length,
        access: access.length,
        vehicles: vehicles.length,
        permits: permits.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards: { label: string; value: number; href: string }[] = counts
    ? [
        { label: 'Contracts', value: counts.contracts, href: '/contracts' },
        { label: 'Invoices', value: counts.invoices, href: '/invoices' },
        { label: 'Visitors', value: counts.visitors, href: '/visitors' },
        { label: 'Access employees', value: counts.access, href: '/access' },
        { label: 'Vehicles', value: counts.vehicles, href: '/parking' },
        { label: 'Permits', value: counts.permits, href: '/parking' },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your organisation overview — scoped to your customer account"
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <>
          {me ? (
            <div className="mb-8 rounded-xl border border-[#e1dfdd] bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Customer profile
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{me.name}</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Code</dt>
                  <dd className="text-slate-700">{me.code}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-slate-700">{me.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-700">{me.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-700">
                    {me.isActive ? 'Active' : 'Inactive'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <a
                key={card.label}
                href={card.href}
                className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
