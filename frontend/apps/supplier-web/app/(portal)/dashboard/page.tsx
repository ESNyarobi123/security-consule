'use client';

import {
  getSupplierMe,
  listSupplierOrders,
  type SupplierProfile,
} from '@pssms/api-client';
import { PageHeader } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function DashboardPage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, orders] = await Promise.all([
        getSupplierMe(),
        listSupplierOrders(),
      ]);
      setMe(profile);
      setOrderCount(orders.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
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
        title="Dashboard"
        description="Your supplier account overview"
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
                Supplier profile
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
                  <dd className="text-slate-700">{me.status}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="/profile"
              className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Profile
              </p>
              <p className="mt-2 text-lg font-medium text-slate-900">
                View supplier details
              </p>
            </a>
            <a
              href="/orders"
              className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Purchase orders
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {orderCount}
              </p>
            </a>
          </div>
        </>
      )}
    </>
  );
}
