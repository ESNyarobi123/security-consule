'use client';

import {
  listCustomerAccessEmployees,
  listCustomerAccessEntries,
  type AccessEmployee,
  type AccessEntry,
} from '@pssms/api-client';
import { RefreshCw, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AvatarBadge,
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalPanel,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  initials,
} from '../../_components/portal-ui';

export default function AccessPage() {
  const [rows, setRows] = useState<AccessEmployee[]>([]);
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, ents] = await Promise.all([
        listCustomerAccessEmployees(),
        listCustomerAccessEntries().catch(() => [] as AccessEntry[]),
      ]);
      setRows(emps);
      setEntries(ents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.id, r.fullName);
    return m;
  }, [rows]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.department?.trim()) set.add(r.department.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const active = rows.filter((r) => r.isActive).length;
  const checkInsToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return entries.filter((e) => {
      const t = new Date(e.recordedAt).getTime();
      return (
        !Number.isNaN(t) &&
        t >= start.getTime() &&
        e.entryType.toUpperCase().includes('IN')
      );
    }).length;
  }, [entries]);

  const filters = [
    { id: 'ALL', label: 'All depts', count: rows.length },
    ...departments.map((d) => ({
      id: d,
      label: d,
      count: rows.filter((r) => (r.department ?? '').trim() === d).length,
    })),
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter !== 'ALL' && (r.department ?? '').trim() !== deptFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.employeeNumber ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.accessCardRef ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, deptFilter]);

  const recentEntries = entries.slice(0, 8);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8"
        title="Staff access"
        subtitle="Your employees registered for site access control — your organisation only (not HIGHLINK guards)."
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

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat label="Registered" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Active" value={loading ? '—' : active} tone="teal" />
        <PortalStat
          label="Departments"
          value={loading ? '—' : departments.length}
          tone="violet"
        />
        <PortalStat
          label="Check-ins today"
          value={loading ? '—' : checkInsToday}
          hint={`${entries.length} recent events`}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortalToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, emp #, card…"
            filters={filters}
            activeFilter={deptFilter}
            onFilterChange={setDeptFilter}
            view={view}
            onViewChange={setView}
          />

          {loading && rows.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-[#edebe9]"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <PortalEmpty
              title="No access employees"
              description="Ask HIGHLINK to register your staff for QR/card/PIN access — records stay in your customer tenant."
              icon={<Users className="h-4 w-4" />}
            />
          ) : view === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((e) => (
                <article
                  key={e.id}
                  className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-[#0078d4]/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <AvatarBadge seed={e.id} label={initials(e.fullName)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#1b1a19]">
                          {e.fullName}
                        </p>
                        <StatusPill status={e.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                        {e.employeeNumber ?? e.id.slice(0, 8)}
                      </p>
                      {e.department ? (
                        <span className="mt-2 inline-flex rounded-full bg-[#eff6fc] px-2 py-0.5 text-[10px] font-semibold text-[#0078d4] ring-1 ring-sky-200/80">
                          {e.department}
                        </span>
                      ) : null}
                      <p className="mt-2 truncate text-xs text-[#605e5c]">
                        {e.email ?? e.phone ?? '—'}
                      </p>
                      {e.accessCardRef ? (
                        <p className="mt-1 font-mono text-[11px] text-[#323130]">
                          Card {e.accessCardRef}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
              <ul className="divide-y divide-[#f3f2f1]">
                {filtered.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarBadge
                        seed={e.id}
                        label={initials(e.fullName)}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {e.fullName}
                        </p>
                        <p className="text-xs text-[#605e5c]">
                          {e.employeeNumber ?? '—'}
                          {e.department ? ` · ${e.department}` : ''}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={e.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <PortalPanel title="Recent gate activity">
          {loading ? (
            <p className="text-sm text-[#605e5c]">Loading…</p>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-[#605e5c]">
              No check-in/out events yet for your staff.
            </p>
          ) : (
            <ul className="divide-y divide-[#edebe9]">
              {recentEntries.map((e) => (
                <li key={e.id} className="py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#1b1a19]">
                        {e.employeeName ??
                          nameById.get(e.employeeId) ??
                          'Staff member'}
                      </p>
                      <p className="text-[11px] text-[#605e5c]">
                        {[e.siteCode, e.siteName].filter(Boolean).join(' · ') ||
                          'Site'}
                        {' · '}
                        {e.accessMethod} · {formatDate(e.recordedAt, true)}
                      </p>
                    </div>
                    <StatusPill status={e.entryType} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>
      </div>

      <PortalDeferral note="Customer employee access is separate from HIGHLINK guard attendance (§33). Other customers’ staff never appear here." />
    </div>
  );
}
