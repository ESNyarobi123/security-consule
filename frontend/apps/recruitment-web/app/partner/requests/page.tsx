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
import { LogOut, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  StatusPill,
  formatDate,
  inputClass,
} from '../../_components/careers-ui';

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
    <CareersShell active="partner">
      <CareersHero
        eyebrow="Portal 35.14 · B2B"
        title={partner ? partner.name : 'Guard supply requests'}
        subtitle={
          partner
            ? `${partner.code} · ${partner.status} — submit criteria and track HIGHLINK triage.`
            : (session?.email ?? 'Partner portal')
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#312e81]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-[#e1dfdd] bg-white p-5 shadow-sm lg:col-span-2"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1b1a19]">
            <Plus className="h-4 w-4 text-[#4f46e5]" /> New request
          </h2>
          <div className="mt-4 space-y-3">
            <Field label="Guard count">
              <input
                type="number"
                min={1}
                max={500}
                value={guardCount}
                onChange={(e) => setGuardCount(Number(e.target.value))}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Site / location" hint="optional">
              <input
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                className={inputClass}
                placeholder="City / site description"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Criteria / notes" hint="optional">
              <textarea
                value={criteriaNotes}
                onChange={(e) => setCriteriaNotes(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Shift, firearms, language, …"
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-bold text-[#1b1a19]">
            Your requests ({rows.length})
          </h2>
          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-10 text-center text-sm text-[#605e5c]">
              No requests yet. Submit your first guard supply request.
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[#e1dfdd] bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-bold text-[#1b1a19]">
                      {r.referenceNumber}
                    </p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-2 text-sm text-[#605e5c]">
                    {r.guardCount} guards
                    {r.siteLocation ? ` · ${r.siteLocation}` : ''}
                    {r.startDate ? ` · from ${r.startDate}` : ''}
                    {` · ${formatDate(r.createdAt) ?? ''}`}
                  </p>
                  {r.criteriaNotes ? (
                    <p className="mt-2 text-xs text-[#323130]">
                      {r.criteriaNotes}
                    </p>
                  ) : null}
                  {r.staffNotes ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      HR note: {r.staffNotes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CareersShell>
  );
}
