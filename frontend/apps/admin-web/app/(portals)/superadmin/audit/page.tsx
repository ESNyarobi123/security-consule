'use client';

import { listAuditLogs, type AuditLog } from '@pssms/api-client';
import { btnSecondary } from '@pssms/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditEmpty, AuditLogRoster } from '../../_components/AuditTrail';
import { fieldCls, formatApiError } from '../_components/shared';

export default function SuperAdminAuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState('all');
  const [actor, setActor] = useState('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAuditLogs(200));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resources = useMemo(() => {
    const set = new Set(rows.map((r) => r.resourceType).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const id = r.actorId ?? 'system';
      const label = r.actorName ?? (r.actorId ? 'Unknown user' : 'System');
      if (!map.has(id)) map.set(id, label);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (resource !== 'all' && r.resourceType !== resource) return false;
      if (actor !== 'all') {
        const id = r.actorId ?? 'system';
        if (id !== actor) return false;
      }
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        (r.actionLabel ?? '').toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q) ||
        (r.resourceId ?? '').toLowerCase().includes(q) ||
        (r.actorName ?? '').toLowerCase().includes(q) ||
        (r.actorEmail ?? '').toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, resource, actor]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a19]">
            System logs & audit controls
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
            Append-only organization audit trail. Every row names the officer who
            acted, the action taken, and the fields that changed — open
            <span className="font-semibold"> Details</span> for the full
            before/after record. DPO/compliance registers stay on the Compliance
            portal.
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          className={fieldCls}
          placeholder="Filter officer / action / resource"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={fieldCls}
          value={resource}
          onChange={(e) => setResource(e.target.value)}
        >
          <option value="all">All resources</option>
          {resources.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className={fieldCls}
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        >
          <option value="all">All officers</option>
          {actors.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <AuditLogRoster
        rows={filtered}
        loading={loading}
        empty={
          <AuditEmpty
            title={rows.length === 0 ? 'No audit events' : 'No matches'}
            description={
              rows.length === 0
                ? 'Mutating actions across portals appear here as an append-only trail (audit.read).'
                : 'Try another search, resource or officer filter.'
            }
          />
        }
      />
      <p className="text-xs text-[#605e5c]">
        Showing {filtered.length} of last {rows.length} events (cap 200).
      </p>
    </div>
  );
}
