'use client';

import {
  createPublicVisitorAppointment,
  getVisitorPublicConfig,
  type VisitorPublicConfig,
} from '@pssms/api-client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VisitorShell } from './_components/VisitorShell';

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

function defaultWindow(): { from: string; until: string } {
  const from = new Date();
  from.setMinutes(0, 0, 0);
  from.setHours(from.getHours() + 1);
  const until = new Date(from);
  until.setHours(until.getHours() + 4);
  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { from: toLocal(from), until: toLocal(until) };
}

export default function VisitorHomePage() {
  const router = useRouter();
  const [config, setConfig] = useState<VisitorPublicConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [visitorFullName, setVisitorFullName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorIdNumber, setVisitorIdNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const defaults = defaultWindow();
  const [validFrom, setValidFrom] = useState(defaults.from);
  const [validUntil, setValidUntil] = useState(defaults.until);
  const [hostName, setHostName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConfigLoading(true);
      setConfigError(null);
      try {
        const remote = await getVisitorPublicConfig();
        if (cancelled) return;
        const resolved = remote ?? envConfig();
        if (!resolved) {
          setConfigError(
            'Visitor portal is not configured. Please contact reception.',
          );
          return;
        }
        setConfig(resolved);
      } catch (err) {
        if (cancelled) return;
        const fallback = envConfig();
        if (fallback) {
          setConfig(fallback);
          return;
        }
        setConfigError(
          err instanceof Error
            ? err.message
            : 'Could not load booking configuration.',
        );
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
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
      const q = new URLSearchParams({
        ref: appointment.referenceNumber,
        name: visitorFullName.trim(),
        from: validFrom,
        until: validUntil,
      });
      if (hostName.trim()) q.set('host', hostName.trim());
      router.push(`/success?${q.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <VisitorShell title="Visitor Appointment" active="book">
      <p className="mt-2 text-sm text-slate-500">
        Pre-register your visit. You receive a reference number only — the gate
        code comes after host approval.
      </p>

      <div id="how" className="mt-6 scroll-mt-8 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">How it works: </span>
        Book → Host approves → Gate code to your phone → Present at gate
      </div>

      {configLoading ? (
        <p className="mt-10 text-sm text-slate-500">Loading form…</p>
      ) : configError ? (
        <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {configError}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 w-full space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className="hl-label" htmlFor="visitorFullName">
                Full name
              </label>
              <input
                id="visitorFullName"
                name="visitorFullName"
                type="text"
                autoComplete="name"
                className="hl-input"
                placeholder="Visitor full name"
                value={visitorFullName}
                onChange={(e) => setVisitorFullName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div>
              <label className="hl-label" htmlFor="visitorPhone">
                Phone
              </label>
              <input
                id="visitorPhone"
                name="visitorPhone"
                type="tel"
                autoComplete="tel"
                className="hl-input"
                placeholder="+255…"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="hl-label" htmlFor="visitorIdNumber">
                ID number
              </label>
              <input
                id="visitorIdNumber"
                name="visitorIdNumber"
                type="text"
                className="hl-input"
                placeholder="NIDA / passport"
                value={visitorIdNumber}
                onChange={(e) => setVisitorIdNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="hl-label" htmlFor="validFrom">
                Valid from
              </label>
              <input
                id="validFrom"
                name="validFrom"
                type="datetime-local"
                className="hl-input"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="hl-label" htmlFor="validUntil">
                Valid until
              </label>
              <input
                id="validUntil"
                name="validUntil"
                type="datetime-local"
                className="hl-input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="hl-label" htmlFor="hostName">
                Host name
              </label>
              <input
                id="hostName"
                name="hostName"
                type="text"
                className="hl-input"
                placeholder="Person you are visiting (optional)"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="hl-label" htmlFor="purpose">
                Purpose of visit
              </label>
              <textarea
                id="purpose"
                name="purpose"
                className="hl-input"
                placeholder="Write the purpose of your visit…"
                rows={4}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                minLength={3}
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="hl-submit max-w-none"
            disabled={loading || !config}
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}
    </VisitorShell>
  );
}
