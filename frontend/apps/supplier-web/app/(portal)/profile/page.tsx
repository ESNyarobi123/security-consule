'use client';

import { getSupplierMe, type SupplierProfile } from '@pssms/api-client';
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  PortalError,
  PortalHero,
  PortalPanel,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

function Field({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#edebe9] bg-[#faf9f8] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#ea580c] shadow-sm ring-1 ring-[#e1dfdd]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium text-[#1b1a19]">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMe(await getSupplierMe());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PortalHero
        eyebrow="Account"
        title="Company profile"
        subtitle="Registered supplier details held by HIGHLINK. Contact procurement to update master data."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      {loading ? (
        <p className="text-sm text-[#605e5c]">Loading company profile…</p>
      ) : me ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
              <div className="bg-gradient-to-br from-[#0b1f3a] to-[#9a3412] px-5 py-6 text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
                  {me.name.slice(0, 1).toUpperCase()}
                </div>
                <h2 className="mt-4 text-xl font-bold tracking-tight">
                  {me.name}
                </h2>
                <p className="mt-1 font-mono text-sm text-amber-100/90">
                  {me.code}
                </p>
                <div className="mt-3">
                  <StatusPill status={me.status} />
                </div>
              </div>
              <div className="space-y-2 px-5 py-4 text-xs text-[#605e5c]">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Registered with HIGHLINK procurement
                </p>
                <p>Joined {formatDate(me.createdAt)}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <PortalPanel title="Registration details">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  icon={<Building2 className="h-5 w-5" />}
                  label="Legal / trading name"
                  value={me.name}
                />
                <Field
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label="Supplier code"
                  value={me.code}
                />
                <Field
                  icon={<Mail className="h-5 w-5" />}
                  label="Email"
                  value={me.email ?? '—'}
                />
                <Field
                  icon={<Phone className="h-5 w-5" />}
                  label="Phone"
                  value={me.phone ?? '—'}
                />
                <Field
                  icon={<Building2 className="h-5 w-5" />}
                  label="TIN"
                  value={me.tin ?? '—'}
                />
                <Field
                  icon={<MapPin className="h-5 w-5" />}
                  label="Address"
                  value={me.address ?? '—'}
                />
              </div>
            </PortalPanel>
            <p className="mt-3 text-xs text-[#605e5c]">
              This portal is read-only for profile fields. Request changes via
              HIGHLINK procurement / Call Centre.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#605e5c]">No profile loaded</p>
      )}
    </>
  );
}
