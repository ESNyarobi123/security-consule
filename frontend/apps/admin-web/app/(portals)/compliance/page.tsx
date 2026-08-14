'use client';

import { listAuditLogs, type AuditLog } from '@pssms/api-client';
import { StatCard, btnSecondary } from '@pssms/ui';
import {
  Activity,
  Clock,
  Layers,
  RefreshCw,
  ScrollText,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AuditEmpty,
  AuditLogRoster,
} from './_components/AuditLogRoster';
import { ComplianceShell } from './_components/ComplianceShell';
import { formatApiError } from './_components/shared';

export default function ComplianceOverviewPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAuditLogs(40));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resourceTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.resourceType) set.add(r.resourceType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stats = useMemo(() => {
    const resourceTypesCount = new Set(rows.map((r) => r.resourceType)).size;
    const actions = new Set(rows.map((r) => r.action)).size;
    const latest = rows.reduce<number>((max, r) => {
      const t = new Date(r.createdAt).getTime();
      return Number.isNaN(t) ? max : Math.max(max, t);
    }, 0);
    return {
      events: rows.length,
      resourceTypes: resourceTypesCount,
      actions,
      latestLabel: latest > 0 ? new Date(latest).toLocaleString() : '—',
      latestRelative:
        latest > 0
          ? new Date(latest).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : undefined,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (resourceFilter !== 'all' && r.resourceType !== resourceFilter)
        return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q) ||
        (r.resourceId ?? '').toLowerCase().includes(q) ||
        (r.actorId ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, resourceFilter]);

  return (
    <ComplianceShell
      title="Audit overview"
      description="Append-only audit trail. Policies, consent/lawful-basis records, and the DPO breach register are under the tabs above. Risk register, DPIA, and backup/DR are deferred."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      }
    >
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        Honest scope: this portal covers audit logs, policy documents (thin
        COMPLIANCE_OFFICER → GM approval), DPO consent / lawful-basis records,
        and the DPO data-breach register. Risk register / DPIA / backup-DR are
        not built yet.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Events loaded"
          value={stats.events}
          hint="Most recent audit entries"
          icon={<ScrollText className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Resource types"
          value={stats.resourceTypes}
          hint="Distinct resources touched"
          icon={<Layers className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Action types"
          value={stats.actions}
          hint="Distinct operations recorded"
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Most recent"
          value={stats.latestRelative ?? '—'}
          hint={stats.events > 0 ? stats.latestLabel : 'No events yet'}
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Audit log
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Append-only trail · policies & breaches under tabs above
          </p>
        </div>
      </div>

      <AuditLogRoster
        rows={filtered}
        loading={loading}
        toolbar={
          <div className="flex flex-col gap-2.5">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search action, resource, actor…"
                className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
              />
            </label>
            {resourceTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setResourceFilter('all')}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    resourceFilter === 'all'
                      ? 'bg-[#0078d4] text-white shadow-sm'
                      : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                  }`}
                >
                  All resources
                  <span
                    className={`ml-1 tabular-nums ${
                      resourceFilter === 'all'
                        ? 'text-white/80'
                        : 'text-[#a19f9d]'
                    }`}
                  >
                    {rows.length}
                  </span>
                </button>
                {resourceTypes.slice(0, 12).map((t) => {
                  const active = resourceFilter === t;
                  const n = rows.filter((r) => r.resourceType === t).length;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setResourceFilter(t)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0078d4] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {t}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/80' : 'text-[#a19f9d]'
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        }
        empty={
          <AuditEmpty
            title={rows.length === 0 ? 'No audit events' : 'No matches'}
            description={
              rows.length === 0
                ? 'Mutating actions across portals appear here as an append-only trail (audit.read).'
                : 'Try another search or resource filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} loaded events
        </p>
      ) : null}
    </ComplianceShell>
  );
}
