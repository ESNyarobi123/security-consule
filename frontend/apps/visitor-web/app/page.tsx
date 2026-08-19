'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookVisitForm } from './_components/BookVisitForm';
import { VisitorShell } from './_components/VisitorShell';

export default function VisitorHomePage() {
  const router = useRouter();

  return (
    <VisitorShell title="Visitor Appointment" active="book">
      <p className="mt-2 text-sm text-slate-500">
        For guests, visitors, contractors, consultants, interview candidates,
        suppliers visiting offices, and customer-approved visitors. Request
        online — the gate verification code is issued only after your host
        approves.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Already registered?{' '}
        <Link href="/contractor/login" className="text-blue-700 hover:underline">
          Contractor
        </Link>
        {' · '}
        <Link href="/consultant/login" className="text-blue-700 hover:underline">
          Consultant
        </Link>
        {' · '}
        <Link href="/provider/login" className="text-blue-700 hover:underline">
          Service provider
        </Link>
        {' '}sign in
      </p>

      <div
        id="how"
        className="mt-6 scroll-mt-8 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
      >
        <span className="font-semibold text-slate-800">How it works: </span>
        Book with host, date/time, and purpose → Host approves → Gate code to
        your email/phone → Present at gate
      </div>

      <BookVisitForm
        mode="public"
        onSuccess={(appointment, extras) => {
          const q = new URLSearchParams({
            ref: appointment.referenceNumber,
            name: appointment.visitorName,
            from: extras.from,
            until: extras.until,
          });
          if (extras.hostName) q.set('host', extras.hostName);
          router.push(`/success?${q.toString()}`);
        }}
      />
    </VisitorShell>
  );
}
