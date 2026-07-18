'use client';

import {
  getOpenJobPosting,
  submitJobApplication,
  type OpenJobPosting,
} from '@pssms/api-client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

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
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link
        href={id ? `/jobs/${id}` : '/'}
        className="text-sm font-medium text-sky-700 hover:text-sky-600"
      >
        ← Back to job
      </Link>

      <header className="mb-8 mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Apply
        </h1>
        {job ? (
          <p className="mt-1 text-sm text-slate-600">{job.title}</p>
        ) : null}
      </header>

      {jobLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input
              type="text"
              name="name"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              required
              minLength={2}
              autoComplete="name"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Email
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

          <label className="block text-sm font-medium text-slate-700">
            Phone{' '}
            <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              autoComplete="tel"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Resume URL{' '}
            <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="url"
              name="resumeUrl"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Cover letter{' '}
            <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              name="coverLetter"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              rows={5}
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
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      )}
    </div>
  );
}
