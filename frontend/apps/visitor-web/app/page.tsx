'use client';

import {
  createPublicVisitorAppointment,
  getVisitorPublicConfig,
  type VisitorPublicConfig,
} from '@pssms/api-client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function envConfig(): VisitorPublicConfig | null {
  const organizationId = process.env.NEXT_PUBLIC_ORG_ID?.trim();
  const customerId = process.env.NEXT_PUBLIC_CUSTOMER_ID?.trim();
  const siteId = process.env.NEXT_PUBLIC_SITE_ID?.trim();
  if (!organizationId || !customerId || !siteId) return null;
  return { organizationId, customerId, siteId };
}

function toIsoLocal(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

export default function VisitorHomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<VisitorPublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [visitorFullName, setVisitorFullName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorIdNumber, setVisitorIdNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [hostName, setHostName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await getVisitorPublicConfig();
      if (cancelled) return;
      const resolved = remote ?? envConfig();
      if (!resolved) {
        setConfigError(
          'Visitor portal is not configured. Set NEXT_PUBLIC_ORG_ID, NEXT_PUBLIC_CUSTOMER_ID, and NEXT_PUBLIC_SITE_ID, or enable GET /api/v1/visitors/public-config.',
        );
        return;
      }
      setConfig(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const purposeWithId = visitorIdNumber.trim()
        ? `${purpose.trim()} (ID: ${visitorIdNumber.trim()})`
        : purpose.trim();
      const appointment = await createPublicVisitorAppointment({
        organizationId: config.organizationId,
        customerId: config.customerId,
        siteId: config.siteId,
        visitorName: visitorFullName.trim(),
        visitorPhone: visitorPhone.trim() || undefined,
        purpose: purposeWithId,
        hostName: hostName.trim() || undefined,
        validFrom: toIsoLocal(validFrom),
        validUntil: toIsoLocal(validUntil),
      });
      router.push(
        `/success?ref=${encodeURIComponent(appointment.referenceNumber)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          HIGHLINK PSSMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Visitor appointment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pre-register your visit. You will receive a reference number only.
        </p>
      </header>

      {configError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {configError}
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
              name="visitorFullName"
              value={visitorFullName}
              onChange={(e) => setVisitorFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              required
              minLength={2}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              type="tel"
              name="visitorPhone"
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            ID number
            <input
              type="text"
              name="visitorIdNumber"
              value={visitorIdNumber}
              onChange={(e) => setVisitorIdNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Purpose
            <textarea
              name="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              rows={3}
              required
              minLength={3}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Valid from
            <input
              type="datetime-local"
              name="validFrom"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Valid until
            <input
              type="datetime-local"
              name="validUntil"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Host name <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="text"
              name="hostName"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !config}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {loading ? 'Submitting…' : 'Submit appointment'}
          </button>
        </form>
      )}
    </div>
  );
}
