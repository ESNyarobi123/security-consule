'use client';

import { getSupplierMe, type SupplierProfile } from '@pssms/api-client';
import { PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function ProfilePage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMe(await getSupplierMe());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
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
        title="Profile"
        description="Registered supplier account details"
      />
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : me ? (
        <div className="rounded-xl border border-[#e1dfdd] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">{me.name}</h2>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Code</dt>
              <dd className="text-slate-700">{me.code}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={me.status} />
              </dd>
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
              <dt className="text-slate-500">TIN</dt>
              <dd className="text-slate-700">{me.tin ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Address</dt>
              <dd className="text-slate-700">{me.address ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-slate-500">No profile loaded</p>
      )}
    </>
  );
}
