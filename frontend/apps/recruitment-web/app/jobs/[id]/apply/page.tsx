'use client';

import {
  getOpenJobPosting,
  submitJobApplication,
  type OpenJobPosting,
} from '@pssms/api-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  inputClass,
} from '../../../_components/careers-ui';

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [job, setJob] = useState<OpenJobPosting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getOpenJobPosting(id);
        if (!cancelled) setJob(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Job not found or closed',
          );
        }
      } finally {
        if (!cancelled) setJobLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const receipt = await submitJobApplication({
        postingId: id,
        applicantName: applicantName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        resumeUrl: resumeUrl.trim() || undefined,
        coverLetter: coverLetter.trim() || undefined,
      });
      router.push(
        `/success?ref=${encodeURIComponent(receipt.referenceNumber)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CareersShell active="careers">
      <Link
        href={id ? `/jobs/${id}` : '/'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4f46e5] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to job
      </Link>

      <CareersHero
        eyebrow="Apply"
        title={job ? job.title : 'Submit application'}
        subtitle="No account needed. You will get a reference number to track your status."
      />

      {jobLoading ? (
        <p className="text-sm text-[#605e5c]">Loading…</p>
      ) : loadError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mx-auto max-w-xl space-y-4 rounded-2xl border border-[#e1dfdd] bg-white p-6 shadow-sm sm:p-8"
        >
          <Field label="Full name">
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className={inputClass}
              required
              minLength={2}
              autoComplete="name"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Phone" hint="optional">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              autoComplete="tel"
            />
          </Field>
          <Field label="Resume URL" hint="optional">
            <input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </Field>
          <Field label="Cover letter" hint="optional">
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className={inputClass}
              rows={5}
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
            className="w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3 font-semibold text-white shadow hover:brightness-105 disabled:opacity-60"
          >
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      )}
    </CareersShell>
  );
}
