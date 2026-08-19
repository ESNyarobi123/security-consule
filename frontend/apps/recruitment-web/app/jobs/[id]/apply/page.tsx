'use client';

import {
  getOpenJobPosting,
  submitJobApplication,
  type OpenJobPosting,
} from '@pssms/api-client';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileUp,
  Link2,
  Mail,
  MapPin,
  Phone,
  Upload,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  formatDate,
  inputClass,
  postingMentionsDocuments,
} from '../../../_components/careers-ui';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const ALLOWED_EXT = /\.(pdf|doc|docx|jpe?g|png)$/i;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
}

function isAllowedFile(file: File) {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return true;
  return ALLOWED_EXT.test(file.name);
}

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(true);

  const wantsDocuments = useMemo(
    () => postingMentionsDocuments(job),
    [job],
  );

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

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError('Document must be 2 MB or smaller.');
      return;
    }
    if (!isAllowedFile(file)) {
      setError('Upload a PDF, Word document, JPG, or PNG.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setResumeUrl(dataUrl);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach file');
    }
  }

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
        bleed
        eyebrow="Apply"
        title={job ? job.title : 'Submit application'}
        subtitle="No account needed. Attach a CV if you have one, then keep your reference number to track status."
      />

      {jobLoading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
      ) : loadError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={onSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex flex-wrap gap-2">
              {[
                { n: '1', label: 'Your details' },
                { n: '2', label: 'Documents' },
                { n: '3', label: 'Submit' },
              ].map((step) => (
                <span
                  key={step.n}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4f46e5] text-[10px] text-white">
                    {step.n}
                  </span>
                  {step.label}
                </span>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                Application form
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Your details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                HIGHLINK recruitment will use this information to screen the
                application. Attach a CV here; HR may add further documents
                after you apply. Interview notices use this email.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className={`${inputClass} pl-11`}
                    required
                    minLength={2}
                    autoComplete="name"
                    placeholder="Your full name"
                  />
                </div>
              </Field>
              <Field label="Email">
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
            </div>
            <Field label="Phone" hint="optional">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} pl-11`}
                  autoComplete="tel"
                  placeholder="+255 …"
                />
              </div>
            </Field>

            <div
              className={`rounded-2xl border border-dashed p-5 ${
                wantsDocuments
                  ? 'border-indigo-300 bg-indigo-50/70'
                  : 'border-indigo-200 bg-indigo-50/40'
              }`}
            >
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Upload className="h-4 w-4 text-[#4f46e5]" />
                Supporting document
                {wantsDocuments ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                    Recommended
                  </span>
                ) : (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    Optional
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {wantsDocuments
                  ? 'This role mentions documents. Attach a CV, ID, or certificate if you have one.'
                  : 'Attach a CV / ID / certificate if you have one. You can still apply without a file.'}{' '}
                PDF, Word, JPG or PNG · max 2 MB.
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-7 text-center transition hover:border-[#4f46e5]/40 hover:bg-slate-50">
                {fileName ? (
                  <Check className="h-6 w-6 text-emerald-600" />
                ) : (
                  <FileUp className="h-6 w-6 text-[#4f46e5]" />
                )}
                <span className="mt-2 text-sm font-semibold text-slate-800">
                  {fileName ? 'Replace file' : 'Choose file to upload'}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {fileName ?? 'No file selected yet'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => void onFileChange(e.target.files?.[0])}
                />
              </label>
              {fileName ? (
                <button
                  type="button"
                  onClick={() => {
                    setFileName(null);
                    setResumeUrl('');
                  }}
                  className="mt-3 text-xs font-semibold text-rose-600 hover:underline"
                >
                  Remove attached file
                </button>
              ) : null}
            </div>

            <Field
              label="Or paste a document URL"
              hint="optional if you uploaded a file"
            >
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={fileName ? '' : resumeUrl}
                  onChange={(e) => {
                    setFileName(null);
                    setResumeUrl(e.target.value);
                  }}
                  placeholder="https://"
                  className={`${inputClass} pl-11`}
                  disabled={!!fileName}
                />
              </div>
            </Field>

            <Field label="Cover letter" hint="optional">
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className={inputClass}
                rows={6}
                placeholder="Why you are a good fit for this role…"
              />
            </Field>

            {error ? (
              <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <p>{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3.5 text-base font-semibold text-white shadow hover:brightness-105 disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Submit application'}
            </button>
          </form>

          <aside className="space-y-4 xl:sticky xl:top-20">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
                Applying for
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {job?.title ?? 'Open role'}
              </h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <dt className="text-slate-500">Department</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {job?.department ?? '—'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <dt className="text-slate-500">Location</dt>
                  <dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-slate-900">
                    <MapPin className="h-4 w-4 text-[#4f46e5]" />
                    {job?.location ?? '—'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <dt className="text-slate-500">Closes</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatDate(job?.closesAt) ?? 'Open until filled'}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              After submit you receive a reference number. Use it with this
              email on{' '}
              <Link href="/status" className="font-semibold text-[#4f46e5]">
                My application
              </Link>
              .
            </section>
          </aside>
        </div>
      )}
    </CareersShell>
  );
}
