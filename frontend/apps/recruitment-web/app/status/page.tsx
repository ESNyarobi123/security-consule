'use client';

import {
  getApplicationStatus,
  respondToJobOffer,
  type ApplicationStatusLookup,
  type JobOffer,
} from '@pssms/api-client';
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  FileSearch,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Wallet,
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
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerNotice, setOfferNotice] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);

  async function lookup(ref: string, mail: string) {
    const data = await getApplicationStatus(ref.trim(), mail.trim());
    setResult(data);
    return data;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setOfferNotice(null);
    setOfferError(null);
    setShowDecline(false);
    try {
      await lookup(reference, email);
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

  async function answerOffer(decision: 'ACCEPT' | 'DECLINE') {
    if (!result) return;
    setOfferBusy(true);
    setOfferError(null);
    setOfferNotice(null);
    try {
      const receipt = await respondToJobOffer({
        reference: result.referenceNumber,
        email: email.trim(),
        decision,
        reason:
          decision === 'DECLINE' ? declineReason.trim() || undefined : undefined,
      });
      setOfferNotice(
        decision === 'ACCEPT'
          ? 'Offer accepted. HIGHLINK Recruitment has been notified and will confirm your start date.'
          : 'Offer declined. Your application has been withdrawn — thank you for telling us.',
      );
      setShowDecline(false);
      setDeclineReason('');
      const refreshed = await lookup(result.referenceNumber, email);
      if (refreshed) setResult(refreshed);
      void receipt;
    } catch (err) {
      setOfferError(
        err instanceof Error ? err.message : 'Could not record your decision',
      );
    } finally {
      setOfferBusy(false);
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

              {result.offer ? (
                <OfferCard
                  offer={result.offer}
                  busy={offerBusy}
                  notice={offerNotice}
                  error={offerError}
                  showDecline={showDecline}
                  declineReason={declineReason}
                  onDeclineReason={setDeclineReason}
                  onToggleDecline={() => setShowDecline((v) => !v)}
                  onAccept={() => void answerOffer('ACCEPT')}
                  onDecline={() => void answerOffer('DECLINE')}
                />
              ) : null}

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

              {result.onboardingSteps?.length ? (
                <div className="mt-5 px-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                    Onboarding steps
                  </p>
                  <ul className="mt-2 space-y-2">
                    {result.onboardingSteps.map((step) => (
                      <li
                        key={step.code}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="text-slate-800">{step.label}</span>
                        <span
                          className={`text-xs font-semibold ${
                            step.done ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {step.done ? 'Done' : 'Pending'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <span>
                  Your offer terms, and the ACCEPT / DECLINE buttons while the
                  offer is still open.
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </CareersShell>
  );
}

function money(amount?: string | null, currency?: string | null) {
  if (!amount) return 'To be confirmed';
  const n = Number(amount);
  if (Number.isNaN(n)) return `${currency ?? ''} ${amount}`.trim();
  return `${currency ?? ''} ${n.toLocaleString()}`.trim();
}

function day(iso?: string | null) {
  if (!iso) return 'To be agreed';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'To be agreed';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function OfferCard({
  offer,
  busy,
  notice,
  error,
  showDecline,
  declineReason,
  onDeclineReason,
  onToggleDecline,
  onAccept,
  onDecline,
}: {
  offer: JobOffer;
  busy: boolean;
  notice: string | null;
  error: string | null;
  showDecline: boolean;
  declineReason: string;
  onDeclineReason: (v: string) => void;
  onToggleDecline: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const open = Boolean(offer.canRespond);
  const tone =
    offer.status === 'ACCEPTED'
      ? 'border-emerald-300 bg-emerald-50/70'
      : offer.status === 'DECLINED'
        ? 'border-rose-200 bg-rose-50/70'
        : offer.status === 'EXPIRED'
          ? 'border-slate-200 bg-slate-50'
          : 'border-amber-300 bg-amber-50/70';

  return (
    <div className={`mx-6 mt-5 rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Formal offer
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {offer.position ?? 'Offer issued'}
          </p>
          <p className="text-sm text-slate-600">
            {offer.department ?? 'HIGHLINK'}
            {offer.employmentType ? ` · ${offer.employmentType}` : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
            offer.status === 'ACCEPTED'
              ? 'bg-emerald-100 text-emerald-800'
              : offer.status === 'DECLINED'
                ? 'bg-rose-100 text-rose-800'
                : offer.status === 'EXPIRED'
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-amber-100 text-amber-900'
          }`}
        >
          {offer.status === 'PENDING' ? 'Action needed' : offer.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-white/70 p-3 ring-1 ring-slate-200">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Wallet className="h-3.5 w-3.5" /> Monthly gross
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {money(offer.salaryAmount, offer.currency)}
          </dd>
        </div>
        <div className="rounded-lg bg-white/70 p-3 ring-1 ring-slate-200">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" /> Proposed start
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {day(offer.startDate)}
          </dd>
        </div>
        <div className="rounded-lg bg-white/70 p-3 ring-1 ring-slate-200">
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <BriefcaseBusiness className="h-3.5 w-3.5" /> Respond by
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {day(offer.expiresAt)}
          </dd>
        </div>
      </dl>

      {offer.message ? (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-white/70 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          {offer.message}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      ) : null}

      {open && !notice ? (
        <div className="mt-4">
          <p className="text-sm text-slate-700">
            Accepting confirms you agree to the terms above. Declining withdraws
            this application.
          </p>
          {showDecline ? (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Reason for declining (optional)
                </span>
                <textarea
                  rows={2}
                  value={declineReason}
                  onChange={(e) => onDeclineReason(e.target.value)}
                  placeholder="e.g. accepted another offer, pay below expectation…"
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDecline}
                  className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Confirm decline'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onToggleDecline}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onAccept}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy ? 'Sending…' : 'Accept offer'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onToggleDecline}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Decline offer
              </button>
            </div>
          )}
        </div>
      ) : null}

      {!open && offer.status === 'PENDING' ? (
        <p className="mt-3 text-sm text-slate-600">
          The response window has closed. Contact HIGHLINK Recruitment to re-issue
          the offer.
        </p>
      ) : null}
      {offer.status === 'ACCEPTED' ? (
        <p className="mt-3 text-sm text-emerald-900">
          You accepted this offer on {day(offer.respondedAt)}. HIGHLINK HR will
          continue with onboarding.
        </p>
      ) : null}
      {offer.status === 'DECLINED' ? (
        <p className="mt-3 text-sm text-rose-900">
          You declined this offer on {day(offer.respondedAt)}.
        </p>
      ) : null}
    </div>
  );
}
