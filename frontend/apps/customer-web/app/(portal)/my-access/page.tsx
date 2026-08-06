'use client';

import {
  getMyAccessSites,
  getMyCustomerAccess,
  listCustomerAccessEntries,
  recordMyAccessEntry,
  type AccessEmployee,
  type AccessEntry,
  type PortalSite,
} from '@pssms/api-client';
import { CreditCard, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [sites, setSites] = useState<PortalSite[]>([]);
  const [sitesUnrestricted, setSitesUnrestricted] = useState(true);
  const [siteId, setSiteId] = useState('');
  const [gateId, setGateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, ents, sitePack] = await Promise.all([
        getMyCustomerAccess(),
        listCustomerAccessEntries().catch(() => [] as AccessEntry[]),
        getMyAccessSites().catch(() => null),
      ]);
      setMe(profile);
      setEntries(ents);
      const activeSites = (sitePack?.sites ?? []).filter((s) => s.isActive);
      setSites(activeSites);
      setSitesUnrestricted(sitePack?.unrestricted ?? true);
      setSiteId((prev) => {
        if (prev && activeSites.some((s) => s.id === prev)) return prev;
        return activeSites[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your access');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gatesForSite = useMemo(() => {
    const site = sites.find((s) => s.id === siteId);
    return site?.gates ?? [];
  }, [sites, siteId]);

  useEffect(() => {
    setGateId((prev) => {
      if (prev && gatesForSite.some((g) => g.id === prev)) return prev;
      return gatesForSite[0]?.id ?? '';
    });
  }, [gatesForSite]);

  const lastType = useMemo(() => {
    const t = entries[0]?.entryType?.toUpperCase();
    if (t === 'CHECK_IN' || t === 'CHECK_OUT') return t;
    return null;
  }, [entries]);

  const suggestedNext =
    lastType === 'CHECK_IN' ? 'CHECK_OUT' : ('CHECK_IN' as const);

  const checkIns = entries.filter((e) => e.entryType === 'CHECK_IN').length;

  async function punch(entryType: 'CHECK_IN' | 'CHECK_OUT') {
    if (!siteId) {
      setError('Select a site first');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await recordMyAccessEntry({
        siteId,
        gateId: gateId || undefined,
        entryType,
        accessMethod: 'QR',
        clientEventId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : undefined,
      });
      const where = [
        created.siteName ?? created.siteCode ?? 'site',
        created.gateName ?? created.gateCode,
      ]
        .filter(Boolean)
        .join(' · ');
      setNotice(
        `${entryType === 'CHECK_IN' ? 'Checked in' : 'Checked out'} at ${where}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PortalHero
        title="My access"
        subtitle="Your customer employee access profile and gate/office entries — your records only (Portal 35.9)."
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
      {notice ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {notice}
        </p>
      ) : null}

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

      <PortalPanel title="Check in / out">
        {!me ? (
          <PortalEmpty
            title="No access profile"
            description="Ask your organisation admin / HIGHLINK to link your login to a staff access record."
          />
        ) : sites.length === 0 ? (
          <PortalEmpty
            title="No sites available"
            description="Your organisation has no active sites for check-in yet."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#605e5c]">
              Record your own office/gate entry (separate from HIGHLINK guard
              attendance). Suggested next:{' '}
              <span className="font-medium text-[#323130]">
                {suggestedNext === 'CHECK_IN' ? 'Check in' : 'Check out'}
              </span>
              . Sites:{' '}
              <span className="font-medium text-[#323130]">
                {sitesUnrestricted
                  ? 'all organisation sites'
                  : 'granted sites only'}
              </span>
              .
            </p>
            <label className="block text-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Site
              </span>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-[#edebe9] bg-white px-3 py-2 text-sm text-[#323130]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8886]">
                Gate
              </span>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-[#edebe9] bg-white px-3 py-2 text-sm text-[#323130]"
              >
                {gatesForSite.length === 0 ? (
                  <option value="">No gates at this site (optional)</option>
                ) : (
                  gatesForSite.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting || !siteId}
                onClick={() => void punch('CHECK_IN')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0078d4] px-3 py-2 text-sm font-medium text-white hover:bg-[#106ebe] disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                Check in
              </button>
              <button
                type="button"
                disabled={submitting || !siteId}
                onClick={() => void punch('CHECK_OUT')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#edebe9] bg-white px-3 py-2 text-sm font-medium text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                Check out
              </button>
            </div>
          </div>
        )}
      </PortalPanel>

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
                Access level
              </dt>
              <dd className="mt-0.5 font-medium text-[#323130]">
                {me.accessLevel ?? 'STANDARD'}
              </dd>
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
            description="Use Check in above, or wait for a gate/device record."
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
                    {e.gateName || e.gateCode
                      ? ` · ${e.gateName ?? e.gateCode}`
                      : ''}
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

      <PortalDeferral note="Self check-in uses QR method (thin). Gate is optional when the site has none. Device bio/card UX comes later. Never mixed with guard attendance (§33)." />
    </div>
  );
}
