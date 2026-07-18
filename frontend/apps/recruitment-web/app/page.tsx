'use client';

import {
  listOpenJobPostings,
  type OpenJobPosting,
} from '@pssms/api-client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CareersHomePage() {
  const [jobs, setJobs] = useState<OpenJobPosting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listOpenJobPostings();
        if (!cancelled) setJobs(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load open jobs',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Open positions
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse roles and apply online. No account required.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading open jobs…</p>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : jobs.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          There are no open positions right now. Check back soon.
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => {
            const closes = formatDate(job.closesAt);
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {[job.department, job.location].filter(Boolean).join(' · ') ||
                      'HIGHLINK'}
                  </p>
                  {closes ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Closes {closes}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
