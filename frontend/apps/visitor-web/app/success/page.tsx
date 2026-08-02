'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { AppointmentTicket } from '../_components/AppointmentTicket';
import { DownloadMenu } from '../_components/DownloadMenu';
import { VisitorShell } from '../_components/VisitorShell';

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const name = params.get('name');
  const host = params.get('host');
  const from = params.get('from');
  const until = params.get('until');
  const [copied, setCopied] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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

  const ticketData = ref
    ? {
        reference: ref,
        visitorName: name || '—',
        hostName: host,
        validFrom: from,
        validUntil: until,
      }
    : null;

  return (
    <VisitorShell title="Appointment submitted" active="success">
      <p className="mt-2 text-sm text-slate-500">
        Keep this visitor pass. You have a reference number only — the gate code
        comes after host approval and is never shown here.
      </p>

      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-[#2563eb] hover:underline"
        >
          &lt; Back
        </Link>
        {ref ? (
          <>
            <button
              type="button"
              onClick={() => void copyRef()}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? 'Reference copied' : 'Copy reference'}
            </button>
            <DownloadMenu
              targetRef={ticketRef}
              fileBaseName={`highlink-visitor-${ref}`}
            />
          </>
        ) : null}
      </div>

      {ticketData ? (
        <div className="mt-8 space-y-6">
          <div className="hidden w-full md:block">
            <AppointmentTicket data={ticketData} variant="landscape" className="w-full" />
          </div>
          <div className="md:hidden">
            <AppointmentTicket data={ticketData} variant="portrait" />
          </div>

          {/* Fixed-size landscape clone for Image/PDF export */}
          <div
            aria-hidden
            className="pointer-events-none fixed left-[-10000px] top-0"
          >
            <AppointmentTicket
              ref={ticketRef}
              data={ticketData}
              variant="landscape"
              className="w-[920px]"
            />
          </div>

          <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/" className="hl-submit text-center no-underline sm:max-w-xs">
              Register another visitor
            </Link>
            <p className="text-xs text-slate-400">
              Tip: use Download → Image or PDF to save your pass.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm text-amber-800">
          No reference in the URL.{' '}
          <Link href="/" className="font-semibold text-[#2563eb] underline">
            Return to the form
          </Link>
          .
        </p>
      )}
    </VisitorShell>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
