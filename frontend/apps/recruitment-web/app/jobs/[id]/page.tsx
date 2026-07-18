'use client';

import {
  getOpenJobPosting,
  type OpenJobPosting,
} from '@pssms/api-client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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

export default function JobDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [job, setJob] = useState<OpenJobPosting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getOpenJobPosting(id);
        if (!cancelled) setJob(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Job not found or closed',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="text-sm font-medium text-sky-700 hover:text-sky-600"
      >
        ← All open positions
      </Link>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : error || !job ? (
        <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error ?? 'Job not found'}
        </p>
      ) : (
        <article className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            HIGHLINK PSSMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {job.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {[job.department, job.location].filter(Boolean).join(' · ')}
          </p>
          {job.closesAt ? (
            <p className="mt-2 text-xs text-slate-500">
              Closes {formatDate(job.closesAt)}
            </p>
          ) : null}

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-800">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {job.description}
            </p>
          </section>

          {job.requirements ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-slate-800">
                Requirements
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {job.requirements}
              </p>
            </section>
          ) : null}

          <Link
            href={`/jobs/${job.id}/apply`}
            className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 sm:w-auto"
          >
            Apply for this role
          </Link>
        </article>
      )}
    </div>
  );
}
