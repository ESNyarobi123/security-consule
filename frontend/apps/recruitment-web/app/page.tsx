'use client';

import { listOpenJobPostings, type OpenJobPosting } from '@pssms/api-client';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Clock3,
  MapPin,
  Search,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CareersHero, CareersShell, formatDate } from './_components/careers-ui';

export default function CareersHomePage() {
  const [jobs, setJobs] = useState<OpenJobPosting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('ALL');

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

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      if (j.department) set.add(j.department);
    }
    return ['ALL', ...[...set].sort()];
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (department !== 'ALL' && j.department !== department) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.department ?? '').toLowerCase().includes(q) ||
        (j.location ?? '').toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    });
  }, [jobs, query, department]);

  const closingSoon = useMemo(() => {
    const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return jobs.filter((job) => {
      if (!job.closesAt) return false;
      const closesAt = new Date(job.closesAt).getTime();
      return !Number.isNaN(closesAt) && closesAt <= soon && closesAt >= Date.now();
    }).length;
  }, [jobs]);

  const featured = filtered.slice(0, 6);

  return (
    <CareersShell active="careers">
      <CareersHero
        eyebrow="Portal 35.13 · Careers"
        title="Build your career with HIGHLINK"
        subtitle="Browse open security and office roles nationwide. Apply online without creating an account, then keep your reference number to follow screening, interview, and hiring updates."
        actions={
          <>
            <Link
              href="/status"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Check application status
            </Link>
            <Link
              href="/partner/login"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#312e81] shadow transition hover:bg-indigo-50"
            >
              Partner portal <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
            Open roles
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {loading ? '—' : jobs.length}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Live positions published by HIGHLINK recruitment
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/70 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
            Departments
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {loading ? '—' : Math.max(departments.length - 1, 0)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Security operations, office, and specialist roles
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-amber-50/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Closing soon
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {loading ? '—' : closingSoon}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Roles ending within the next 7 days
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                  Browse vacancies
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Find the right role faster
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search by title, location, or department, then open the role to
                  read full requirements and apply.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
                <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                {loading
                  ? 'Loading open positions…'
                  : `${filtered.length} role${filtered.length === 1 ? '' : 's'} shown`}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, department, location, or description…"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/15"
                />
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#4f46e5] focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/15"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === 'ALL' ? 'All departments' : d}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 px-6 py-14 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-indigo-500" />
              <p className="mt-3 font-semibold text-slate-900">
                No matching open roles
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try another search or department filter, or check back soon.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {featured.map((job) => {
                const closes = formatDate(job.closesAt);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100">
                        {job.department ?? 'HIGHLINK'}
                      </span>
                      {closes ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          Closes {closes}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 group-hover:text-[#312e81]">
                      {job.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">
                      {job.description}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location ?? 'Tanzania'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Apply online
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">
                        View details and submit application
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#4f46e5]">
                        Open role <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
              How hiring works
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
                  1
                </span>
                <span>Open a role and review the full description and requirements.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
                  2
                </span>
                <span>Apply online and keep your reference number for follow-up.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
                  3
                </span>
                <span>Track screening, interview, and final hiring status on the status page.</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1f3a] via-[#123a63] to-[#4f46e5] p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
              Need a different path?
            </p>
            <div className="mt-4 space-y-3">
              <Link
                href="/status"
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-200" />
                  My application status
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/partner/login"
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-sky-200" />
                  Other security company partner
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
              Why HIGHLINK
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                  <Shield className="h-4 w-4 text-[#4f46e5]" />
                  Nationwide security operations
                </p>
                <p className="mt-1 text-slate-500">
                  Roles across guards, supervisors, field teams, and office units.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="inline-flex items-center gap-2 font-semibold text-slate-900">
                  <Briefcase className="h-4 w-4 text-[#4f46e5]" />
                  Structured recruitment flow
                </p>
                <p className="mt-1 text-slate-500">
                  Screening, interview, onboarding, and auditable status tracking.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </CareersShell>
  );
}
