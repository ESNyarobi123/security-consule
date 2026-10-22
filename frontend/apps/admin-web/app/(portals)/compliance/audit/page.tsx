'use client';

import { listAuditLogs, type AuditLog } from '@pssms/api-client';
import { GlassCard, StatCard, btnPrimary, btnSecondary } from '@pssms/ui';
import {
  Activity,
  Layers,
  RefreshCw,
  ScrollText,
  Search,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditEmpty, AuditLogRoster } from '../../_components/AuditTrail';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError } from '../_components/shared';

const TAKE_OPTIONS = [50, 100, 200] as const;

export default function ComplianceAuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [take, setTake] = useState<number>(100);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await listAuditLogs({
          take,
          ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
          ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
        }),
      );
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [take, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const resourceTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.resourceType) set.add(r.resourceType);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const id = r.actorId ?? 'system';
      if (!map.has(id)) {
        map.set(id, r.actorName ?? (r.actorId ? 'Unknown user' : 'System'));
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (resourceFilter !== 'all' && r.resourceType !== resourceFilter) {
        return false;
      }
      if (actorFilter !== 'all') {
        const id = r.actorId ?? 'system';
        if (id !== actorFilter) return false;
      }
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        (r.actionLabel ?? '').toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q) ||
        (r.resourceLabel ?? '').toLowerCase().includes(q) ||
        (r.resourceId ?? '').toLowerCase().includes(q) ||
        (r.actorName ?? '').toLowerCase().includes(q) ||
        (r.actorEmail ?? '').toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, resourceFilter, actorFilter]);

  const stats = useMemo(() => {
    const officers = new Set(rows.map((r) => r.actorId ?? 'system')).size;
    const changes = rows.reduce(
      (sum, r) => sum + (r.changedFields?.length ?? 0),
      0,
    );
    const denied = rows.filter((r) =>
      /reject|delete|void|fail|deny|suspend/i.test(r.action),
    ).length;
    return { officers, changes, denied };
  }, [rows]);

  return (
    <ComplianceShell
      title="Audit log"
      description="Append-only organization trail — every row names the officer, the action taken, and the exact fields that changed. Open Details for the before/after snapshots (secrets redacted)."
      actions={
        <>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Events loaded"
          value={rows.length}
          hint={`Newest ${take} requested`}
          icon={<ScrollText className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Officers involved"
          value={stats.officers}
          hint="Distinct actors in this window"
          icon={<UserRound className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Field changes"
          value={stats.changes}
          hint="Before → after values captured"
          icon={<Layers className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Refusals / void"
          value={stats.denied}
          hint="Reject · deny · suspend · void"
          icon={<Activity className="h-5 w-5" />}
          accent="rose"
        />
      </div>

      <GlassCard glow="none" className="mb-4 p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] md:items-end">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
            <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Officer, action, resource, summary…"
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
            />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8886]">
            Officer
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#e1dfdd] bg-white px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[#323130] outline-none focus:border-[#0078d4]"
            >
              <option value="all">All officers</option>
              {actors.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8886]">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#e1dfdd] bg-white px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[#323130] outline-none focus:border-[#0078d4]"
            />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8886]">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#e1dfdd] bg-white px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[#323130] outline-none focus:border-[#0078d4]"
            />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8886]">
            Rows
            <select
              value={take}
              onChange={(e) => setTake(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[#e1dfdd] bg-white px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[#323130] outline-none focus:border-[#0078d4]"
            >
              {TAKE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btnPrimary} onClick={() => void load()}>
            Apply
          </button>
        </div>
        {resourceTypes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
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
                  resourceFilter === 'all' ? 'text-white/80' : 'text-[#a19f9d]'
                }`}
              >
                {rows.length}
              </span>
            </button>
            {resourceTypes.slice(0, 14).map((t) => {
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
      </GlassCard>

      <AuditLogRoster
        rows={filtered}
        loading={loading}
        empty={
          <AuditEmpty
            title={rows.length === 0 ? 'No audit events' : 'No matches'}
            description={
              rows.length === 0
                ? 'Mutating actions across portals appear here as an append-only trail (audit.read). Widen the period or clear filters.'
                : 'Try another search, resource, officer, or period.'
            }
          />
        }
      />
      <p className="mt-2 text-[11px] text-[#605e5c]">
        Showing {filtered.length} of {rows.length} loaded events · API cap 200.
        Every mutation across the platform writes here — creator, action,
        resource and changed fields.
      </p>
    </ComplianceShell>
  );
}
