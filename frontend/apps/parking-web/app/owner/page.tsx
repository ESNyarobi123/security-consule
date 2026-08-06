'use client';

import {
  getParkingOwnerMe,
  listOwnerEntries,
  listOwnerPermits,
  type ParkingOpsEntry,
  type ParkingOpsPermit,
  type ParkingOwnerProfile,
} from '@pssms/api-client';
import {
  clearOwnerSession,
  getOwnerSessionUser,
  getOwnerToken,
} from '@pssms/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function OwnerSelfViewPage() {
  const router = useRouter();
  const [me, setMe] = useState<ParkingOwnerProfile | null>(null);
  const [permits, setPermits] = useState<ParkingOpsPermit[]>([]);
  const [entries, setEntries] = useState<ParkingOpsEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getOwnerToken()) {
      router.replace('/owner/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, permitRows, entryRows] = await Promise.all([
        getParkingOwnerMe(),
        listOwnerPermits(),
        listOwnerEntries(),
      ]);
      setMe(profile);
      setPermits(permitRows);
      setEntries(entryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function signOut() {
    clearOwnerSession();
    router.replace('/owner/login');
  }

  const session = getOwnerSessionUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Approved vehicle owner
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            My parking
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {me
              ? `${me.fullName} · ${me.email}`
              : session?.email ?? 'Owner portal'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Vehicles
            </h2>
            {me?.vehicles?.length ? (
              <ul className="mt-3 space-y-2">
                {me.vehicles.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-slate-900">
                      {v.plateNumber}
                    </p>
                    <p className="text-sm text-slate-600">
                      {[v.make, v.model, v.color, v.vehicleType]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {v.rfidTagRef ? (
                      <p className="mt-2 inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 font-mono text-xs font-medium text-teal-800 ring-1 ring-teal-200">
                        RFID · {v.rfidTagRef}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No vehicles linked to this account yet.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Permits
            </h2>
            {permits.length ? (
              <ul className="mt-3 space-y-2">
                {permits.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {p.permitNumber}
                      </p>
                      <span className="text-xs font-medium uppercase text-teal-700">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {p.plateNumber ?? '—'} · {p.siteName ?? p.siteCode ?? 'Site'}{' '}
                      · {p.permitType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(p.validFrom)} → {fmtDate(p.validUntil)}
                    </p>
                    {p.feeAmount != null || p.invoiceNumber ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.feeAmount != null ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                            Fee ·{' '}
                            {p.feeAmount.toLocaleString()}{' '}
                            {p.currency?.trim() || 'TZS'}
                          </span>
                        ) : null}
                        {p.invoiceNumber ? (
                          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 font-mono text-xs font-medium text-teal-800 ring-1 ring-teal-200">
                            Invoice · {p.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No permits yet.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recent entries
            </h2>
            {entries.length ? (
              <ul className="mt-3 space-y-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {e.plateNumber}
                      </p>
                      <span className="text-xs font-medium uppercase text-slate-600">
                        {e.direction}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {e.siteName ?? e.siteCode ?? 'Site'} · {fmtDate(e.recordedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No gate entries yet.</p>
            )}
          </section>

          <p className="text-xs text-slate-400">
            Read-only self-view. Billing and ANPR decide stay with parking ops.{' '}
            <Link href="/login" className="text-teal-700 hover:underline">
              Ops portal
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
