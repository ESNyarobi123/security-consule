'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get('ref');

  return (
    <div className="mx-auto min-h-[70vh] max-w-lg px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Application submitted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep this reference number. You can check status later with your email
          and this reference.
        </p>

        {ref ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Reference number
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900">
              {ref}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-amber-700">
            No reference number in the URL. Return to open jobs and apply again.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/status" className="text-sky-700 hover:text-sky-600">
            Check application status
          </Link>
          <Link href="/" className="text-slate-600 hover:text-slate-800">
            Browse more jobs
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
