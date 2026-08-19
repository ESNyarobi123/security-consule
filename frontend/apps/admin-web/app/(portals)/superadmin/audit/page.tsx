'use client';

import { listAuditLogs, type AuditLog } from '@pssms/api-client';
import { GlassCard, btnSecondary } from '@pssms/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

export default function SuperAdminAuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState('all');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (resource !== 'all' && r.resourceType !== resource) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q) ||
        (r.resourceId ?? '').toLowerCase().includes(q) ||
        (r.actorId ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, resource]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a19]">
            System logs & audit controls
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
            Append-only organization audit trail. Mutations already write here.
            DPO/compliance registers stay on the Compliance portal.
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
          placeholder="Filter action / resource"
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
      </div>
      <GlassCard glow="none" className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#e1dfdd] text-xs uppercase text-[#605e5c]">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">Actor</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[#605e5c]" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-[#f3f2f1]">
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">{r.resourceType}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.resourceId ? r.resourceId.slice(0, 8) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.actorId ? r.actorId.slice(0, 8) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>
      <p className="text-xs text-[#605e5c]">
        Showing {filtered.length} of last {rows.length} events (cap 200).
      </p>
    </div>
  );
}
