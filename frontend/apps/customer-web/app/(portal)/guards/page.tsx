'use client';

import {
  getCustomerPortalDeployments,
  type PortalDeployment,
} from '@pssms/api-client';
import { RefreshCw, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AvatarBadge,
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
  initials,
} from '../../_components/portal-ui';

export default function GuardsPage() {
  const [rows, setRows] = useState<PortalDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('cards');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCustomerPortalDeployments());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load assigned guards',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = rows.filter((r) => r.status.toUpperCase().includes('ACTIVE')).length;
  const sites = useMemo(
    () => new Set(rows.map((r) => r.site.id)).size,
    [rows],
  );

  const filters = useMemo(() => {
    const map: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      const k = r.status.toUpperCase().replace(/[\s-]+/g, '_');
      map[k] = (map[k] ?? 0) + 1;
    }
    return [
      { id: 'ALL', label: 'All', count: map.ALL },
      ...Object.keys(map)
        .filter((k) => k !== 'ALL')
        .map((k) => ({
          id: k,
          label: k.replace(/_/g, ' '),
          count: map[k],
        })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL') {
        const s = r.status.toUpperCase().replace(/[\s-]+/g, '_');
        if (s !== statusFilter) return false;
      }
      if (!q) return true;
      const name = r.guard.fullName ?? '';
      return (
        r.guard.guardNumber.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        r.site.code.toLowerCase().includes(q) ||
        r.site.name.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Services · Portal 35.8"
        title="Assigned guards"
        subtitle="HIGHLINK officers deployed to your sites — guard number, optional name, site and deployment status. No internal HR or biometrics."
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

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <PortalStat label="Deployments" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Active" value={loading ? '—' : active} tone="teal" />
        <PortalStat label="Sites covered" value={loading ? '—' : sites} tone="violet" />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search guard #, name, site…"
        filters={filters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        view={view}
        onViewChange={setView}
      />

      {loading && rows.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No deployments yet"
          description={
            error
              ? 'Could not load deployments. Retry when the portal API is available.'
              : 'When HIGHLINK assigns officers to your sites, they will appear in this roster.'
          }
          icon={<Shield className="h-4 w-4" />}
        />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => {
            const label = d.guard.fullName || d.guard.guardNumber;
            return (
              <article
                key={d.id}
                className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm transition hover:border-teal-400/50 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <AvatarBadge seed={d.guard.id} label={initials(label, 'GD')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1b1a19]">
                          {d.guard.fullName || 'Officer'}
                        </p>
                        <p className="font-mono text-[11px] text-[#8a8886]">
                          {d.guard.guardNumber}
                        </p>
                      </div>
                      <StatusPill status={d.status} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#0d9488]">
                      {d.site.code} · {d.site.name}
                    </p>
                    <p className="mt-1 text-[11px] text-[#605e5c]">
                      From {formatDate(d.startAt)}
                      {d.endAt ? ` → ${formatDate(d.endAt)}` : ' · ongoing'}
                    </p>
                    {d.guard.status ? (
                      <p className="mt-2">
                        <StatusPill status={d.guard.status} />
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarBadge
                    seed={d.guard.id}
                    label={initials(d.guard.fullName || d.guard.guardNumber, 'GD')}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {d.guard.fullName || d.guard.guardNumber}
                    </p>
                    <p className="text-xs text-[#605e5c]">
                      {d.guard.guardNumber} · {d.site.code} {d.site.name}
                    </p>
                  </div>
                </div>
                <StatusPill status={d.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortalDeferral note="Sensitive HR fields (discipline, loans, biometrics) stay inside HIGHLINK — customers see deployment roster only." />
    </div>
  );
}
