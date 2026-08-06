'use client';

import {
  getConsultantMe,
  listConsultantEntries,
  type ConsultantVisitProfile,
  type VisitorEntry,
} from '@pssms/api-client';
import {
  clearConsultantSession,
  getConsultantSessionUser,
  getConsultantToken,
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

export default function ConsultantSelfViewPage() {
  const router = useRouter();
  const [me, setMe] = useState<ConsultantVisitProfile | null>(null);
  const [entries, setEntries] = useState<VisitorEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getConsultantToken()) {
      router.replace('/consultant/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profile, entryRows] = await Promise.all([
        getConsultantMe(),
        listConsultantEntries(),
      ]);
      setMe(profile);
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
    clearConsultantSession();
    router.replace('/consultant/login');
  }

  const session = getConsultantSessionUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            External consultant
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            My visits
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {me
              ? `${me.fullName} · ${me.email}`
              : session?.email ?? 'Consultant portal'}
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
              Appointments ({me?.appointmentCount ?? 0})
            </h2>
            {me?.appointments?.length ? (
              <ul className="mt-3 space-y-2">
                {me.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {a.referenceNumber}
                      </p>
                      <span className="text-xs font-medium uppercase text-indigo-700">
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{a.purpose}</p>
                    <p className="text-xs text-slate-500">
                      {a.siteName ?? a.siteCode ?? 'Site'} · Host{' '}
                      {a.hostName ?? '—'} · {fmtDate(a.validFrom)} →{' '}
                      {fmtDate(a.validUntil)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Gate code is sent after host approval — not shown here.
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No appointments linked to this account yet.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Gate entries
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
                        {e.visitorName}
                      </p>
                      <span className="text-xs font-medium uppercase text-slate-600">
                        {e.result}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {fmtDate(e.recordedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No gate verification entries yet.
              </p>
            )}
          </section>

          <p className="text-xs text-slate-400">
            Read-only self-view. Host approve and gate verify stay with staff.{' '}
            <Link href="/" className="text-indigo-700 hover:underline">
              Book a new visit
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
