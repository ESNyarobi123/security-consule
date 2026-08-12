'use client';

import {
  getApplicationStatus,
  type ApplicationStatusLookup,
} from '@pssms/api-client';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Circle,
  Clock3,
  FileSearch,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  StatusPill,
  formatDate,
  inputClass,
} from '../_components/careers-ui';

const DEMO_REF = 'VOL-APP-01';
const DEMO_EMAIL = 'vol.app.01@example.com';

function resultTone(status: string) {
  const s = status.toUpperCase();
  if (s === 'HIRED' || s === 'OFFERED') {
    return {
      wrap: 'border-emerald-200 bg-emerald-50/70',
      iconWrap: 'bg-emerald-100 text-emerald-700',
      Icon: CheckCircle2,
    };
  }
  if (s === 'REJECTED') {
    return {
      wrap: 'border-rose-200 bg-rose-50/70',
      iconWrap: 'bg-rose-100 text-rose-700',
      Icon: XCircle,
    };
  }
  if (s === 'WITHDRAWN') {
    return {
      wrap: 'border-slate-200 bg-slate-50',
      iconWrap: 'bg-slate-200 text-slate-700',
      Icon: Circle,
    };
  }
  return {
    wrap: 'border-indigo-200 bg-indigo-50/60',
    iconWrap: 'bg-indigo-100 text-indigo-700',
    Icon: Clock3,
  };
}

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

  const tone = result ? resultTone(result.status) : null;

  return (
    <CareersShell active="status">
      <CareersHero
        bleed
        eyebrow="My application"
        title="Check application status"
        subtitle="Use the reference number from your confirmation page together with the same email you used during application."
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-slate-100 backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-sky-200" />
            Applicant lookup is protected by reference + email
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                <FileSearch className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                  Lookup form
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Search your application
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the exact reference number and applicant email to retrieve
                  the current stage.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Reference number" hint="from confirmation page">
                <div className="relative">
                  <FileSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="APP-… or VOL-APP-…"
                    className={`${inputClass} pl-11 font-mono`}
                    required
                    minLength={3}
                    autoComplete="off"
                  />
                </div>
              </Field>

              <Field label="Email used to apply">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputClass} pl-11`}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
              </Field>

              {error ? (
                <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="font-semibold">Could not look up this application</p>
                    <p className="mt-0.5 text-rose-700">{error}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                {loading ? 'Looking up…' : 'Look up status'}
              </button>
            </form>
          </section>

          {result && tone ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                      Result
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                      {result.postingTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Reference{' '}
                      <span className="font-mono font-semibold text-slate-700">
                        {result.referenceNumber}
                      </span>
                    </p>
                  </div>
                  <StatusPill status={result.statusLabel || result.status} />
                </div>
              </div>

              <div className={`mx-6 mt-5 flex gap-3 rounded-xl border px-4 py-3 ${tone.wrap}`}>
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
                >
                  <tone.Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {result.statusLabel || result.status.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {result.statusHint ||
                      'This is the current stage recorded for your application.'}
                  </p>
                </div>
              </div>

              {result.stages?.length ? (
                <ol className="mt-5 grid gap-2 px-6 sm:grid-cols-5">
                  {result.stages.map((stage) => {
                    const done = stage.state === 'done';
                    const current = stage.state === 'current';
                    const skipped = stage.state === 'skipped';
                    return (
                      <li
                        key={stage.key}
                        className={`rounded-xl px-3 py-3 text-center ring-1 ${
                          current
                            ? 'bg-indigo-50 ring-indigo-200'
                            : done
                              ? 'bg-emerald-50 ring-emerald-100'
                              : skipped
                                ? 'bg-slate-50 ring-slate-100 opacity-60'
                                : 'bg-white ring-slate-200'
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {stage.label}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {current
                            ? 'Current'
                            : done
                              ? 'Done'
                              : skipped
                                ? '—'
                                : 'Next'}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Submitted
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatDate(result.submittedAt, true) ?? '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {result.department ?? 'HIGHLINK'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    <MapPin className="h-4 w-4 text-[#4f46e5]" />
                    {result.location ?? '—'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1f3a] via-[#153a63] to-[#4f46e5] p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
              Demo lookup
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              After seed/demo data, try the sample application below.
            </p>
            <div className="mt-4 rounded-xl bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Reference
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-white">
                {DEMO_REF}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-300">
                Email
              </p>
              <p className="mt-1 font-mono text-sm text-white">{DEMO_EMAIL}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReference(DEMO_REF);
                setEmail(DEMO_EMAIL);
                setError(null);
              }}
              className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#312e81] shadow hover:bg-indigo-50"
            >
              Use demo details
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
              What you can see
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <span>Submitted role title and current application stage.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                  <Clock3 className="h-4 w-4" />
                </span>
                <span>
                  When the application was submitted and tracked in the system.
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </CareersShell>
  );
}
