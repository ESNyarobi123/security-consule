'use client';

import {
  getCctvAccessMonitor,
  type CctvAccessMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvAccessPage() {
  const [pack, setPack] = useState<CctvAccessMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvAccessMonitor());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#605e5c]">
          Employee check-in {pack?.checkIns24h ?? '—'} / out{' '}
          {pack?.checkOuts24h ?? '—'} (24h). Visitor gate denies:{' '}
          {pack?.visitorDenies24h ?? '—'}. Customer staff stay access.*; guards
          stay attendance.*.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <h2 className="mb-2 text-sm font-semibold">Customer employee punches</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.accessEntries ?? []}
        emptyMessage="No access punches in the last 24 hours"
        columns={[
          { key: 'siteCode', label: 'Site' },
          { key: 'entryType', label: 'Type' },
          { key: 'accessMethod', label: 'Method' },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
          },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Visitor gate denies</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.visitorDenies ?? []}
        emptyMessage="No visitor denies in the last 24 hours"
        columns={[
          { key: 'visitorName', label: 'Visitor' },
          { key: 'siteCode', label: 'Site' },
          {
            key: 'result',
            label: 'Result',
            render: (r) => <StatusBadge status={r.result} />,
          },
          { key: 'denyReason', label: 'Reason' },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
          },
        ]}
      />
      {pack?.notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{pack.notes[0]}</p>
      ) : null}
    </div>
  );
}
