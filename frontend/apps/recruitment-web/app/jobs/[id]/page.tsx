'use client';

import {
  getOpenJobPosting,
  type OpenJobPosting,
} from '@pssms/api-client';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  formatDate,
} from '../../_components/careers-ui';

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
    <CareersShell active="careers">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4f46e5] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All open positions
      </Link>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-[#e1dfdd]" />
      ) : error || !job ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error ?? 'Job not found'}
        </p>
      ) : (
        <>
          <CareersHero
            eyebrow={job.department ?? 'HIGHLINK'}
            title={job.title}
            subtitle={[job.location, formatDate(job.closesAt) ? `Closes ${formatDate(job.closesAt)}` : null]
              .filter(Boolean)
              .join(' · ')}
            actions={
              <Link
                href={`/jobs/${job.id}/apply`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#312e81] shadow transition hover:bg-indigo-50"
              >
                Apply now <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="space-y-6 rounded-2xl border border-[#e1dfdd] bg-white p-6 shadow-sm lg:col-span-2">
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#605e5c]">
                  About the role
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#323130]">
                  {job.description}
                </p>
              </section>
              {job.requirements ? (
                <section>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-[#605e5c]">
                    Requirements
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#323130]">
                    {job.requirements}
                  </p>
                </section>
              ) : null}
            </article>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#e1dfdd] bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  Role summary
                </p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-[#605e5c]">Department</dt>
                    <dd className="font-medium text-[#1b1a19]">
                      {job.department ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#605e5c]">Location</dt>
                    <dd className="inline-flex items-center gap-1 font-medium text-[#1b1a19]">
                      <MapPin className="h-3.5 w-3.5 text-[#4f46e5]" />
                      {job.location ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#605e5c]">Closes</dt>
                    <dd className="font-medium text-[#1b1a19]">
                      {formatDate(job.closesAt) ?? 'Open until filled'}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/jobs/${job.id}/apply`}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3 text-sm font-semibold text-white shadow hover:brightness-105"
                >
                  Apply for this role
                </Link>
              </div>
              <p className="text-xs text-[#605e5c]">
                After you submit, you will receive a reference number. Use it
                with your email on{' '}
                <Link href="/status" className="font-semibold text-[#4f46e5]">
                  My application
                </Link>
                .
              </p>
            </aside>
          </div>
        </>
      )}
    </CareersShell>
  );
}
