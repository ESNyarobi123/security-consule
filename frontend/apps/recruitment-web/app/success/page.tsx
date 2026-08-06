'use client';

import { CheckCircle2, Copy } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CareersHero, CareersShell } from '../_components/careers-ui';

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const [copied, setCopied] = useState(false);

  async function copyRef() {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <CareersShell active="careers">
      <CareersHero
        eyebrow="Application received"
        title="Thank you for applying"
        subtitle="Keep your reference number safe. Use it with your email to check status any time."
      />

      <div className="mx-auto max-w-lg rounded-2xl border border-[#e1dfdd] bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-8 w-8" />
          </span>
        </div>
        <h2 className="mt-4 text-center text-xl font-bold text-[#1b1a19]">
          Application submitted
        </h2>

        {ref ? (
          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
              Reference number
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-mono text-xl font-bold text-[#1b1a19]">{ref}</p>
              <button
                type="button"
                onClick={() => void copyRef()}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4f46e5]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-amber-700">
            No reference in the URL. Return to open jobs and apply again.
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/status"
            className="rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-2.5 text-sm font-semibold text-white shadow"
          >
            Check status
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-[#e1dfdd] bg-white px-4 py-2.5 text-sm font-semibold text-[#323130]"
          >
            Browse more jobs
          </Link>
        </div>
      </div>
    </CareersShell>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-[#605e5c]">
          Loading…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
