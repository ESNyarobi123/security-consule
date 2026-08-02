'use client';

import {
  getCustomerMe,
  getCustomerPortalSites,
  type CustomerProfile,
  type PortalSite,
} from '@pssms/api-client';
import { getCustomerSessionUser, type SessionUser } from '@pssms/auth';
import {
  Building2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  PortalDeferral,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  StatusPill,
  avatarColor,
  initials,
} from '../../_components/portal-ui';

export default function ProfilePage() {
  const [me, setMe] = useState<CustomerProfile | null>(null);
  const [sites, setSites] = useState<PortalSite[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUser(getCustomerSessionUser());
    try {
      const [profile, siteRows] = await Promise.all([
        getCustomerMe(),
        getCustomerPortalSites().catch(() => [] as PortalSite[]),
      ]);
      setMe(profile);
      setSites(siteRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = user?.fullName || me?.name || 'Portal user';
  const color = avatarColor(user?.email || me?.code || 'x');

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Account"
        title="Profile & organisation"
        subtitle="Portal identity and company profile. Additional portal users are invited by HIGHLINK Super Admin."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <PortalStat
          label="Account"
          value={me?.isActive ? 'Active' : loading ? '—' : 'Inactive'}
          tone={me?.isActive ? 'emerald' : 'rose'}
        />
        <PortalStat
          label="Sites linked"
          value={loading ? '—' : sites.length}
          hint="Your premises only"
          tone="teal"
        />
        <PortalStat
          label="Portal role"
          value="Customer"
          hint="Read-scoped JWT"
          tone="sky"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PortalPanel title="Signed-in user">
          <div className="flex items-center gap-3">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {initials(displayName, 'U')}
            </span>
            <div>
              <p className="text-base font-semibold text-[#1b1a19]">
                {user?.fullName || '—'}
              </p>
              <p className="text-sm text-[#605e5c]">{user?.email || '—'}</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-[#0078d4]" />
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Role</dt>
                <dd className="font-medium text-[#323130]">
                  {(user?.roles ?? ['CUSTOMER_PORTAL']).join(', ')}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold">
                Session scoped to your customer — no other tenants visible
              </span>
            </div>
          </dl>
        </PortalPanel>

        <PortalPanel title="Organisation">
          {me ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-teal-700" />
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">Company</dt>
                  <dd className="font-semibold text-[#1b1a19]">{me.name}</dd>
                  <dd className="font-mono text-xs text-[#605e5c]">{me.code}</dd>
                </div>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Contact</dt>
                <dd className="text-[#323130]">{me.contactPerson ?? '—'}</dd>
                <dd className="text-[#323130]">{me.email ?? '—'}</dd>
                <dd className="text-[#323130]">{me.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Address</dt>
                <dd className="text-[#323130]">{me.address ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Status</dt>
                <dd className="mt-1">
                  <StatusPill status={me.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          )}
        </PortalPanel>

        <PortalPanel title="Your sites">
          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading sites…</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-[#605e5c]">
              No sites linked yet. HIGHLINK ops will attach premises to your
              customer record.
            </p>
          ) : (
            <ul className="space-y-2">
              {sites.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#0078d4]" />
                    <span className="text-sm font-semibold text-[#1b1a19]">
                      {s.name}
                    </span>
                    {!s.isActive ? (
                      <StatusPill status="INACTIVE" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-[#605e5c]">
                    {s.code}
                  </p>
                  {s.address ? (
                    <p className="mt-1 text-xs text-[#605e5c]">{s.address}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>
      </div>

      <PortalDeferral note="Additional portal users are invited by HIGHLINK Super Admin from the customer record — not self-service here." />
    </div>
  );
}
