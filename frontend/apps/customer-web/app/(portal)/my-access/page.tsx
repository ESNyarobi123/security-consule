'use client';

import {
  getMyCustomerAccess,
  listCustomerAccessEntries,
  type AccessEmployee,
  type AccessEntry,
} from '@pssms/api-client';
import { CreditCard, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

export default function MyAccessPage() {
  const [me, setMe] = useState<AccessEmployee | null>(null);
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, ents] = await Promise.all([
        getMyCustomerAccess(),
        listCustomerAccessEntries().catch(() => [] as AccessEntry[]),
      ]);
      setMe(profile);
      setEntries(ents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your access');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkIns = entries.filter((e) => e.entryType === 'CHECK_IN').length;

  return (
    <div className="space-y-6">
      <PortalHero
        title="My access"
        subtitle="Your customer employee access profile and recent gate/office entries — your records only (Portal 35.9)."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <PortalStat
          label="Status"
          value={loading ? '—' : me?.isActive ? 'Active' : 'Inactive'}
          hint="Access roster status"
        />
        <PortalStat
          label="Recent entries"
          value={loading ? '—' : String(entries.length)}
          hint="Last 100 (own only)"
        />
        <PortalStat
          label="Check-ins"
          value={loading ? '—' : String(checkIns)}
          hint="In recent list"
        />
      </div>

      <PortalPanel title="Your profile">
        {loading && !me ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : !me ? (
          <PortalEmpty
            title="No access profile"
            description="Ask your organisation admin / HIGHLINK to link your login to a staff access record."
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Name
              </dt>
              <dd className="mt-0.5 font-medium text-[#1b1a19]">{me.fullName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Employee #
              </dt>
              <dd className="mt-0.5 font-mono text-[#323130]">
                {me.employeeNumber ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Department
              </dt>
              <dd className="mt-0.5 text-[#323130]">{me.department ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Email
              </dt>
              <dd className="mt-0.5 text-[#323130]">{me.email ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Access card
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[#323130]">
                <CreditCard className="h-3.5 w-3.5 text-[#0078d4]" />
                {me.accessCardRef ?? '—'}
              </dd>
            </div>
          </dl>
        )}
      </PortalPanel>

      <PortalPanel title="Your recent entries">
        {loading && entries.length === 0 ? (
          <p className="text-sm text-[#605e5c]">Loading…</p>
        ) : entries.length === 0 ? (
          <PortalEmpty
            title="No entries yet"
            description="Gate or office check-in/out will appear here when recorded for you."
          />
        ) : (
          <ul className="divide-y divide-[#edebe9]">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <StatusPill status={e.entryType} />
                  <p className="mt-1 text-[#605e5c]">
                    {e.siteName ?? e.siteCode ?? e.siteId.slice(0, 8)}
                    {' · '}
                    {e.accessMethod}
                  </p>
                </div>
                <span className="text-xs text-[#8a8886]">
                  {formatDate(e.recordedAt, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PortalPanel>

      <PortalDeferral note="This is your access record — not HIGHLINK guard attendance (§33). QR/bio self check-in and site-level grants come later." />
    </div>
  );
}
