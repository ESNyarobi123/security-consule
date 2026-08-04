'use client';

import {
  createPartnerGuardSupplyRequest,
  getB2bPartnerMe,
  listPartnerGuardSupplyRequests,
  type B2bPartnerProfile,
  type GuardSupplyRequest,
} from '@pssms/api-client';
import {
  clearPartnerSession,
  getPartnerSessionUser,
  getPartnerToken,
} from '@pssms/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

export default function PartnerRequestsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<B2bPartnerProfile | null>(null);
  const [rows, setRows] = useState<GuardSupplyRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guardCount, setGuardCount] = useState(8);
  const [siteLocation, setSiteLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [criteriaNotes, setCriteriaNotes] = useState('');

  const refresh = useCallback(async () => {
    if (!getPartnerToken()) {
      router.replace('/partner/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [me, list] = await Promise.all([
        getB2bPartnerMe(),
        listPartnerGuardSupplyRequests(),
      ]);
      setPartner(me);
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPartnerGuardSupplyRequest({
        guardCount,
        siteLocation: siteLocation.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        criteriaNotes: criteriaNotes.trim() || undefined,
      });
      setSiteLocation('');
      setCriteriaNotes('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearPartnerSession();
    router.replace('/partner/login');
  }

  const session = getPartnerSessionUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Other security company
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Guard supply requests
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {partner
              ? `${partner.name} (${partner.code}) · ${partner.status}`
              : session?.email ?? 'Partner portal'}
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

      <form
        onSubmit={onCreate}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-sm font-semibold text-slate-900">New request</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            Guard count
            <input
              type="number"
              min={1}
              max={500}
              value={guardCount}
              onChange={(e) => setGuardCount(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm text-slate-600">
            Site / location
            <input
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="City / site description"
            />
          </label>
          <label className="text-sm text-slate-600">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-slate-600">
          Criteria / notes
          <textarea
            value={criteriaNotes}
            onChange={(e) => setCriteriaNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Shift, firearms, language, …"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Your requests
        </h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {r.referenceNumber}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {r.guardCount} guards
                  {r.siteLocation ? ` · ${r.siteLocation}` : ''}
                  {r.startDate ? ` · from ${r.startDate}` : ''}
                </p>
                {r.criteriaNotes ? (
                  <p className="mt-1 text-xs text-slate-500">{r.criteriaNotes}</p>
                ) : null}
                {r.staffNotes ? (
                  <p className="mt-2 text-xs text-amber-800">
                    HR note: {r.staffNotes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-slate-500">
        <Link href="/" className="text-sky-700 hover:underline">
          ← Public careers
        </Link>
      </p>
    </div>
  );
}
