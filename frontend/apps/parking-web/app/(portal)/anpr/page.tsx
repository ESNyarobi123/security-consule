'use client';

import {
  decideAnpr,
  listAnprResults,
  type AnprResult,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

type AnprRow = {
  id: string;
  plateNumber: string;
  decision: string;
  confidence: string;
  capturedAt: string;
  siteId: string;
  denyReason: string;
};

function toRow(r: AnprResult): AnprRow {
  return {
    id: r.id,
    plateNumber: r.plateNumber,
    decision: r.decision ?? 'PENDING',
    confidence:
      r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—',
    capturedAt: r.capturedAt,
    siteId: r.siteId,
    denyReason: r.denyReason ?? '—',
  };
}

function sortPendingFirst(rows: AnprRow[]): AnprRow[] {
  return [...rows].sort((a, b) => {
    const ap = a.decision === 'PENDING' ? 0 : 1;
    const bp = b.decision === 'PENDING' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return b.capturedAt.localeCompare(a.capturedAt);
  });
}

export default function AnprPage() {
  const [rows, setRows] = useState<AnprRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await listAnprResults();
      setRows(sortPendingFirst(results.map(toRow)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ANPR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDecide(id: string, decision: 'ALLOW' | 'DENY') {
    setBusyId(id);
    setError(null);
    try {
      await decideAnpr(id, {
        decision,
        denyReason: decision === 'DENY' ? denyReason || undefined : undefined,
      });
      if (decision === 'DENY') setDenyReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="ANPR"
        description="Plate recognition results only — never embed video players"
      />
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <label className="mb-4 block max-w-md text-sm text-slate-600">
        Deny reason (optional)
        <input
          type="text"
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          placeholder="e.g. no permit / blacklisted"
          className="mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
        />
      </label>
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No ANPR results"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          {
            key: 'decision',
            label: 'Decision',
            render: (row) => <StatusBadge status={row.decision} />,
          },
          { key: 'confidence', label: 'Confidence' },
          { key: 'capturedAt', label: 'Captured' },
          { key: 'siteId', label: 'Site' },
          { key: 'denyReason', label: 'Deny reason' },
          {
            key: 'id',
            label: 'Actions',
            render: (row) =>
              row.decision === 'PENDING' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void onDecide(row.id, 'ALLOW')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void onDecide(row.id, 'DENY')}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    Deny
                  </button>
                </div>
              ) : (
                <span className="text-slate-500">—</span>
              ),
          },
        ]}
      />
    </>
  );
}
