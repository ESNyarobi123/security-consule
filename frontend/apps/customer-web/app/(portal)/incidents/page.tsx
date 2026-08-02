'use client';

import {
  getCustomerPortalIncidents,
  type PortalIncident,
} from '@pssms/api-client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PortalDeferral,
  PortalEmpty,
  PortalError,
  PortalHero,
  PortalStat,
  PortalToolbar,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

export default function IncidentsPage() {
  const [rows, setRows] = useState<PortalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [view, setView] = useState<'cards' | 'list'>('list');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCustomerPortalIncidents());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load incidents',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = rows.filter((r) => {
    const s = r.status.toUpperCase();
    return s.includes('OPEN') || s.includes('INVESTIGAT');
  }).length;
  const critical = rows.filter((r) =>
    r.severity.toUpperCase().includes('CRITICAL') ||
    r.severity.toUpperCase().includes('HIGH'),
  ).length;

  const statusFilters = useMemo(() => {
    const map: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      const k = r.status.toUpperCase().replace(/[\s-]+/g, '_');
      map[k] = (map[k] ?? 0) + 1;
    }
    return [
      { id: 'ALL', label: 'All status', count: map.ALL },
      ...Object.keys(map)
        .filter((k) => k !== 'ALL')
        .map((k) => ({ id: k, label: k.replace(/_/g, ' '), count: map[k] })),
    ];
  }, [rows]);

  const severityFilters = useMemo(() => {
    const map: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      const k = r.severity.toUpperCase().replace(/[\s-]+/g, '_');
      map[k] = (map[k] ?? 0) + 1;
    }
    return [
      { id: 'ALL', label: 'All severity', count: map.ALL },
      ...Object.keys(map)
        .filter((k) => k !== 'ALL')
        .map((k) => ({ id: k, label: k.replace(/_/g, ' '), count: map[k] })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL') {
        const s = r.status.toUpperCase().replace(/[\s-]+/g, '_');
        if (s !== statusFilter) return false;
      }
      if (severityFilter !== 'ALL') {
        const s = r.severity.toUpperCase().replace(/[\s-]+/g, '_');
        if (s !== severityFilter) return false;
      }
      if (!q) return true;
      return (
        r.incidentNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.siteCode ?? '').toLowerCase().includes(q) ||
        (r.siteName ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, severityFilter]);

  return (
    <div className="w-full">
      <PortalHero
        eyebrow="Site ops · Portal 35.8"
        title="Incidents & complaints"
        subtitle="Incidents on your premises scoped to your organisation. Raise new complaints via your HIGHLINK account manager or Call Centre."
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
        <PortalStat label="Total" value={loading ? '—' : rows.length} tone="sky" />
        <PortalStat label="Open / investigating" value={loading ? '—' : open} tone="amber" />
        <PortalStat label="High / critical" value={loading ? '—' : critical} tone="rose" />
      </div>

      <PortalToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search incident #, title, site…"
        filters={statusFilters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        view={view}
        onViewChange={setView}
        trailing={
          <div className="flex flex-wrap gap-1.5">
            {severityFilters.map((f) => {
              const active = severityFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSeverityFilter(f.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    active
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9]'
                  }`}
                >
                  {f.label}
                  {typeof f.count === 'number' ? (
                    <span className="tabular-nums opacity-80">{f.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        }
      />

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#edebe9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmpty
          title="No incidents"
          description={
            error
              ? 'Could not load incidents. Retry when the portal incidents API is available.'
              : 'Incidents recorded against your sites will list here. To raise a new complaint, contact HIGHLINK Call Centre.'
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((inc) => (
            <article
              key={inc.id}
              className="rounded-2xl border border-[#e1dfdd] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-mono text-[11px] text-[#8a8886]">
                  {inc.incidentNumber}
                </p>
                <div className="flex flex-wrap gap-1">
                  <StatusPill status={inc.severity} />
                  <StatusPill status={inc.status} />
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-[#1b1a19]">
                {inc.title}
              </h3>
              {inc.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-[#605e5c]">
                  {inc.description}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-[#605e5c]">
                {inc.category.replace(/_/g, ' ')}
                {inc.siteCode || inc.siteName
                  ? ` · ${[inc.siteCode, inc.siteName].filter(Boolean).join(' ')}`
                  : ''}
              </p>
              <p className="mt-2 text-[11px] text-[#8a8886]">
                Opened {formatDate(inc.createdAt, true)}
                {inc.resolvedAt
                  ? ` · Resolved ${formatDate(inc.resolvedAt, true)}`
                  : ''}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
          <div className="hidden border-b border-[#edebe9] bg-[#faf9f8] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a8886] md:grid md:grid-cols-[auto_1.4fr_1fr_auto_auto_auto]">
            <span>#</span>
            <span>Title</span>
            <span>Site</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Opened</span>
          </div>
          <ul className="divide-y divide-[#f3f2f1]">
            {filtered.map((inc) => (
              <li
                key={inc.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[auto_1.4fr_1fr_auto_auto_auto] md:items-center"
              >
                <p className="font-mono text-xs font-semibold text-[#323130]">
                  {inc.incidentNumber}
                </p>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1b1a19]">
                    {inc.title}
                  </p>
                  <p className="truncate text-[11px] text-[#8a8886]">
                    {inc.description?.trim() ||
                      inc.category.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className="text-xs text-[#605e5c]">
                  {[inc.siteCode, inc.siteName].filter(Boolean).join(' · ') || '—'}
                </p>
                <StatusPill status={inc.severity} />
                <StatusPill status={inc.status} />
                <p className="text-xs text-[#605e5c]">{formatDate(inc.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortalDeferral note="Incident create/escalate workflow remains with HIGHLINK branch ops. This portal is a read-only customer view of your sites." />
    </div>
  );
}
