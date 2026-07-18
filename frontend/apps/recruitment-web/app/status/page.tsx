'use client';

import {
  getApplicationStatus,
  type ApplicationStatusLookup,
} from '@pssms/api-client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

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
    <div className="mx-auto max-w-lg px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Application status
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the reference number from your confirmation email or success
          page, plus the email you used to apply.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-slate-700">
          Reference number
          <input
            type="text"
            name="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="APP-…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 outline-none ring-sky-500 focus:ring-2"
            required
            minLength={3}
            autoComplete="off"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Email used to apply
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
            required
            autoComplete="email"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {loading ? 'Looking up…' : 'Look up status'}
        </button>
      </form>

      {result ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Reference
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
            {result.referenceNumber}
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {result.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Position</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {result.postingTitle}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="mt-0.5 text-slate-800">
                {new Date(result.submittedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <Link
        href="/"
        className="mt-8 inline-block text-sm font-medium text-sky-700 hover:text-sky-600"
      >
        ← Browse open positions
      </Link>
    </div>
  );
}
