'use client';

import {
  listCustomerPortalContacts,
  type CustomerContact,
} from '@pssms/api-client';
import { RefreshCw, Star, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
} from '../../_components/portal-ui';

const ROLE_LABEL: Record<string, string> = {
  GENERAL: 'General',
  BILLING: 'Billing',
  OPERATIONS: 'Operations',
  SECURITY: 'Security',
  OTHER: 'Other',
};

export default function ContactsPage() {
  const [rows, setRows] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomerPortalContacts());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load contacts',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const primaryCount = useMemo(
    () => rows.filter((r) => r.isPrimary).length,
    [rows],
  );

  const roleFilters = useMemo(() => {
    const map: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      map[r.role] = (map[r.role] ?? 0) + 1;
    }
    return [
      { id: 'ALL', label: 'All', count: map.ALL },
      ...Object.keys(map)
        .filter((k) => k !== 'ALL')
        .sort()
        .map((k) => ({
          id: k,
          label: ROLE_LABEL[k] ?? k,
          count: map[k],
        })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== 'ALL' && r.role !== roleFilter) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.designation ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Account · Module 6"
        title="Company contacts"
        subtitle="People HIGHLINK may reach for billing, operations, and security. Read-only — updates are managed by HIGHLINK CRM."
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
          label="Contacts"
          value={loading ? '—' : rows.length}
          hint="Active directory"
          tone="sky"
        />
        <PortalStat
          label="Primary"
          value={loading ? '—' : primaryCount}
          hint="Main company contact"
          tone="teal"
        />
        <PortalStat
          label="Roles"
          value={
            loading
              ? '—'
              : new Set(rows.map((r) => r.role)).size
          }
          hint="Billing / ops / security"
          tone="emerald"
        />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone…"
        filters={roleFilters}
        activeFilter={roleFilter}
        onFilterChange={setRoleFilter}
      />

      {loading ? (
        <p className="mt-6 text-sm text-[#605e5c]">Loading contacts…</p>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          icon={<Users className="h-8 w-8 text-[#a19f9d]" />}
          title="No contacts"
          description={
            rows.length === 0
              ? 'HIGHLINK has not registered company contacts yet.'
              : 'No contacts match this filter.'
          }
        />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-[#e1dfdd] bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#1b1a19]">
                    {c.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-[#605e5c]">
                    {[ROLE_LABEL[c.role] ?? c.role, c.designation]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {c.isPrimary ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#deecf9] px-2 py-0.5 text-[11px] font-semibold text-[#0078d4]">
                    <Star className="h-3 w-3" />
                    Primary
                  </span>
                ) : (
                  <StatusPill status={c.role} />
                )}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm text-[#323130]">
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">Email</dt>
                  <dd>{c.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[#605e5c]">Phone</dt>
                  <dd>
                    {[c.phone, c.altPhone].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <PortalDeferral note="Portal cannot edit contacts — ask HIGHLINK marketing / account manager via Super Admin CRM." />
    </div>
  );
}
