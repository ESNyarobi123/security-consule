'use client';

import {
  getApplicationStatus,
  type ApplicationStatusLookup,
} from '@pssms/api-client';
import { Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  StatusPill,
  formatDate,
  inputClass,
} from '../_components/careers-ui';

export default function StatusLookupPage() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<ApplicationStatusLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getApplicationStatus(
        reference.trim(),
        email.trim(),
      );
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not find an application with that reference and email',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <CareersShell active="status">
      <CareersHero
        eyebrow="My application"
        title="Check application status"
        subtitle="Use the reference number from your confirmation page plus the email you applied with."
      />

      <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-5">
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-[#e1dfdd] bg-white p-6 shadow-sm lg:col-span-3"
        >
          <Field label="Reference number">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="APP-… or VOL-APP-…"
              className={`${inputClass} font-mono`}
              required
              minLength={3}
              autoComplete="off"
            />
          </Field>
          <Field label="Email used to apply">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
              autoComplete="email"
            />
          </Field>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3 font-semibold text-white shadow hover:brightness-105 disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Looking up…' : 'Look up status'}
          </button>
        </form>

        <div className="lg:col-span-2">
          {result ? (
            <div className="rounded-2xl border border-[#e1dfdd] bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Reference
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-[#1b1a19]">
                {result.referenceNumber}
              </p>
              <div className="mt-4">
                <StatusPill status={result.status} />
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[#605e5c]">Position</dt>
                  <dd className="font-medium text-[#1b1a19]">
                    {result.postingTitle}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#605e5c]">Submitted</dt>
                  <dd className="text-[#323130]">
                    {formatDate(result.submittedAt, true) ?? '—'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-sm text-[#605e5c]">
              Demo tip: after seed, try reference{' '}
              <span className="font-mono text-[#312e81]">VOL-APP-01</span> with
              email{' '}
              <span className="font-mono text-[#312e81]">
                vol.app.01@example.com
              </span>
              .
            </div>
          )}
        </div>
      </div>
    </CareersShell>
  );
}
