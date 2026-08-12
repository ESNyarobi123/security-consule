'use client';

import { getOpenJobPosting, type OpenJobPosting } from '@pssms/api-client';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  formatDate,
  postingMentionsDocuments,
  splitJobCopy,
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

  const aboutBlocks = useMemo(
    () => splitJobCopy(job?.description),
    [job?.description],
  );
  const requirementBlocks = useMemo(
    () => splitJobCopy(job?.requirements),
    [job?.requirements],
  );

  return (
    <CareersShell active="careers">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4f46e5] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All open positions
      </Link>

      {loading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
      ) : error || !job ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error ?? 'Job not found'}
        </p>
      ) : (
        <>
          <CareersHero
            bleed
            eyebrow={job.department ?? 'HIGHLINK'}
            title={job.title}
            subtitle={[
              job.location,
              formatDate(job.closesAt)
                ? `Closes ${formatDate(job.closesAt)}`
                : 'Open until filled',
            ]
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Building2 className="h-4 w-4 text-[#4f46e5]" />
                Department
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {job.department ?? 'HIGHLINK'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <MapPin className="h-4 w-4 text-[#4f46e5]" />
                Location
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {job.location ?? 'Tanzania'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <CalendarClock className="h-4 w-4 text-[#4f46e5]" />
                Closing date
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatDate(job.closesAt) ?? 'Open until filled'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                    Role details
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    About the role
                  </h2>
                </div>
                <div className="space-y-4 px-6 py-6">
                  {aboutBlocks.length ? (
                    aboutBlocks.map((block, index) => (
                      <p
                        key={`${index}-${block.slice(0, 24)}`}
                        className="text-base leading-relaxed text-slate-600"
                      >
                        {block}
                      </p>
                    ))
                  ) : (
                    <p className="text-base text-slate-500">
                      Full role description will be provided during screening.
                    </p>
                  )}
                </div>
              </article>

              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                    <CheckCircle2 className="h-4 w-4" />
                    Requirements
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    What HIGHLINK looks for
                  </h2>
                </div>
                <div className="px-6 py-6">
                  {requirementBlocks.length ? (
                    <ul className="space-y-3">
                      {requirementBlocks.map((item, index) => (
                        <li
                          key={`${index}-${item.slice(0, 24)}`}
                          className="flex gap-3 text-base text-slate-600"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                            <BadgeCheck className="h-3.5 w-3.5" />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base text-slate-500">
                      Requirements will be confirmed during application review.
                    </p>
                  )}
                </div>
              </article>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-20">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                  Role summary
                </p>
                <dl className="mt-4 space-y-4 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <dt className="text-slate-500">Department</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {job.department ?? '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-[#4f46e5]" />
                      {job.location ?? '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <dt className="text-slate-500">Closes</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <Clock3 className="h-4 w-4 text-[#4f46e5]" />
                      {formatDate(job.closesAt) ?? 'Open until filled'}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/jobs/${job.id}/apply`}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3 text-sm font-semibold text-white shadow hover:brightness-105"
                >
                  Apply for this role <ArrowRight className="h-4 w-4" />
                </Link>
                {postingMentionsDocuments(job) ? (
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    This posting mentions documents. Attach a CV or supporting
                    file on the application form.
                  </p>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    You can attach a CV on the next step, or apply with your
                    details only.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1f3a] via-[#153a63] to-[#4f46e5] p-5 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
                  How to apply
                </p>
                <ul className="mt-4 space-y-3 text-sm text-slate-200">
                  <li className="flex gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                    Complete the application form — no account required.
                  </li>
                  <li className="flex gap-3">
                    <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                    Attach a CV / supporting document if the role needs it.
                  </li>
                  <li className="flex gap-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                    Keep your reference number to track status later.
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </CareersShell>
  );
}
