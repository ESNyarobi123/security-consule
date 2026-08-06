'use client';

import {
  listOpenJobPostings,
  type OpenJobPosting,
} from '@pssms/api-client';
import {
  ArrowRight,
  Briefcase,
  MapPin,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  formatDate,
} from './_components/careers-ui';

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

  return (
    <CareersShell active="careers">
      <CareersHero
        eyebrow="Portal 35.13 · Careers"
        title="Build your career with HIGHLINK"
        subtitle="Browse open security and office roles nationwide. Apply online — no account required. Keep your reference number to track status."
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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1b1a19]">Open positions</h2>
          <p className="text-sm text-[#605e5c]">
            {loading
              ? 'Loading…'
              : `${filtered.length} role${filtered.length === 1 ? '' : 's'} shown`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a19f9d]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, dept, location…"
              className="w-full rounded-xl border border-[#e1dfdd] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
            />
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-xl border border-[#e1dfdd] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4f46e5]"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All departments' : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-[#e1dfdd]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 px-6 py-14 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-indigo-500" />
          <p className="mt-3 font-semibold text-[#1b1a19]">
            No matching open roles
          </p>
          <p className="mt-1 text-sm text-[#605e5c]">
            Try another search, or check back soon.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((job) => {
            const closes = formatDate(job.closesAt);
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                      {job.department ?? 'HIGHLINK'}
                    </span>
                    {closes ? (
                      <span className="text-[11px] text-[#605e5c]">
                        Closes {closes}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#1b1a19] group-hover:text-[#312e81]">
                    {job.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-[#605e5c]">
                    {job.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-[#605e5c]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location ?? 'Tanzania'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#4f46e5]">
                      View & apply <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CareersShell>
  );
}
