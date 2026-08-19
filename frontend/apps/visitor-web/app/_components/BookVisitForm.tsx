'use client';

import {
  createOwnVisitorAppointment,
  createPublicVisitorAppointment,
  getVisitorPublicConfig,
  type CreatePublicAppointmentInput,
  type VisitorAppointment,
  type VisitorPublicConfig,
} from '@pssms/api-client';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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

const FALLBACK_KINDS = [
  { value: 'GUEST', label: 'Guest' },
  { value: 'VISITOR', label: 'Visitor' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'INTERVIEW_CANDIDATE', label: 'Interview candidate' },
  { value: 'SUPPLIER_VISIT', label: 'Supplier visiting office' },
  { value: 'CUSTOMER_APPROVED', label: 'Customer-approved visitor' },
];

export type BookVisitFormProps = {
  mode: 'public' | 'self';
  token?: string;
  defaultVisitKind?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultCompany?: string;
  onSuccess: (
    appointment: VisitorAppointment,
    extras: { hostName?: string; from: string; until: string },
  ) => void;
};

export function BookVisitForm({
  mode,
  token,
  defaultVisitKind,
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
  defaultCompany = '',
  onSuccess,
}: BookVisitFormProps) {
  const [config, setConfig] = useState<VisitorPublicConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [visitorFullName, setVisitorFullName] = useState(defaultName);
  const [visitorEmail, setVisitorEmail] = useState(defaultEmail);
  const [visitorPhone, setVisitorPhone] = useState(defaultPhone);
  const [companyName, setCompanyName] = useState(defaultCompany);
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [visitKind, setVisitKind] = useState(defaultVisitKind ?? 'VISITOR');
  const [purpose, setPurpose] = useState('');
  const defaults = useMemo(() => defaultWindow(), []);
  const [validFrom, setValidFrom] = useState(defaults.from);
  const [validUntil, setValidUntil] = useState(defaults.until);
  const [hostUserId, setHostUserId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [withVehicle, setWithVehicle] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
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
        setSiteId(resolved.siteId);
        if (resolved.hosts?.length === 1) {
          setHostUserId(resolved.hosts[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        const fallback = envConfig();
        if (fallback) {
          setConfig(fallback);
          setSiteId(fallback.siteId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const kinds = config?.visitKinds?.length ? config.visitKinds : FALLBACK_KINDS;
  const hosts = config?.hosts ?? [];
  const sites = config?.sites ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    if (!visitorEmail.trim() && !visitorPhone.trim()) {
      setError('Provide an email or phone so the gate code can be sent after approval.');
      return;
    }
    if (!hosts.length || !hostUserId) {
      setError('Select the host you are visiting.');
      return;
    }
    if (withVehicle && !vehiclePlate.trim()) {
      setError('Enter the vehicle plate, or uncheck arriving by vehicle.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const trimmedIdType = idType.trim();
      const trimmedIdNumber = idNumber.trim();
      const selectedHost = hosts.find((h) => h.id === hostUserId);
      const body: CreatePublicAppointmentInput = {
        organizationId: config.organizationId,
        customerId: config.customerId,
        siteId: siteId || config.siteId,
        visitorName: visitorFullName.trim(),
        visitorEmail: visitorEmail.trim() || undefined,
        visitorPhone: visitorPhone.trim() || undefined,
        companyName: companyName.trim() || undefined,
        purpose: purpose.trim(),
        visitKind,
        hostUserId: hostUserId || undefined,
        hostName: selectedHost?.fullName,
        vehiclePlate: withVehicle ? vehiclePlate.trim() : undefined,
        ...(trimmedIdType
          ? {
              idType: trimmedIdType as
                | 'NIDA'
                | 'PASSPORT'
                | 'DRIVERS_LICENSE'
                | 'OTHER',
            }
          : {}),
        ...(trimmedIdNumber ? { idNumber: trimmedIdNumber } : {}),
        validFrom: toIsoLocal(validFrom),
        validUntil: toIsoLocal(validUntil),
      };
      const appointment =
        mode === 'self' && token
          ? await createOwnVisitorAppointment(body, token)
          : await createPublicVisitorAppointment(body);
      onSuccess(appointment, {
        hostName: selectedHost?.fullName,
        from: validFrom,
        until: validUntil,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  if (configLoading) {
    return <p className="mt-10 text-sm text-slate-500">Loading form…</p>;
  }
  if (configError) {
    return (
      <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {configError}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 w-full space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="hl-label" htmlFor="visitKind">
            I am visiting as
          </label>
          <select
            id="visitKind"
            className="hl-input"
            value={visitKind}
            onChange={(e) => setVisitKind(e.target.value)}
            required
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {sites.length > 1 ? (
          <div>
            <label className="hl-label" htmlFor="siteId">
              Site / office
            </label>
            <select
              id="siteId"
              className="hl-input"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              required
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="hl-label" htmlFor="siteLabel">
              Site / office
            </label>
            <input
              id="siteLabel"
              className="hl-input"
              value={config?.siteCode ?? 'Assigned site'}
              readOnly
            />
          </div>
        )}

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
          <label className="hl-label" htmlFor="visitorEmail">
            Email
          </label>
          <input
            id="visitorEmail"
            type="email"
            autoComplete="email"
            className="hl-input"
            placeholder="name@company.com"
            value={visitorEmail}
            onChange={(e) => setVisitorEmail(e.target.value)}
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
        <p className="lg:col-span-2 -mt-3 text-xs text-slate-500">
          Email or phone is required. After your host approves, the verification
          code is sent on those channels — never shown at booking.
        </p>

        <div className="lg:col-span-2">
          <label className="hl-label" htmlFor="companyName">
            Company / organisation{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="companyName"
            type="text"
            className="hl-input"
            placeholder="Employer or sending company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div>
          <label className="hl-label" htmlFor="idType">
            ID type <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="idType"
            name="idType"
            className="hl-input"
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
          >
            <option value="">No ID document</option>
            <option value="NIDA">NIDA</option>
            <option value="PASSPORT">Passport</option>
            <option value="DRIVERS_LICENSE">Driver&apos;s licence</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="hl-label" htmlFor="idNumber">
            ID number <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="idNumber"
            name="idNumber"
            type="text"
            className="hl-input"
            placeholder="Document number"
            maxLength={64}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
        </div>

        <div>
          <label className="hl-label" htmlFor="validFrom">
            Date and time — from
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
            Until
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
          <label className="hl-label" htmlFor="host">
            Host
          </label>
          {hosts.length ? (
            <select
              id="host"
              className="hl-input"
              value={hostUserId}
              onChange={(e) => setHostUserId(e.target.value)}
              required
            >
              <option value="">Select the person you are visiting</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.fullName}
                  {h.kind === 'PORTAL' ? ' (customer host)' : ' (employee)'}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hosts are published for this customer. Contact reception.
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="hl-label" htmlFor="purpose">
            Purpose of visit
          </label>
          <textarea
            id="purpose"
            name="purpose"
            className="hl-input"
            placeholder="Meeting, delivery, interview, maintenance…"
            rows={4}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            minLength={3}
          />
        </div>

        <div className="lg:col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={withVehicle}
              onChange={(e) => setWithVehicle(e.target.checked)}
            />
            Arriving by vehicle
          </label>
          {withVehicle ? (
            <input
              className="hl-input mt-3"
              placeholder="Vehicle plate"
              maxLength={32}
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              required
            />
          ) : null}
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
        disabled={loading || !config || (mode === 'self' && !token)}
      >
        {loading ? 'Submitting…' : 'Request appointment'}
      </button>
    </form>
  );
}
