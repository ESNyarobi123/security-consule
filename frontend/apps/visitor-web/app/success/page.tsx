'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get('ref');

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Appointment submitted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep this reference number. A verification code is issued separately
          after host approval — it is never shown here.
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
            No reference number in the URL. Return to the form and submit again.
          </p>
        )}

        <Link
          href="/"
          className="mt-8 inline-block text-sm font-medium text-sky-700 hover:text-sky-600"
        >
          Register another visitor
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          Loading…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
