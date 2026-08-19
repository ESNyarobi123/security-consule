'use client';

import {
  getCctvPatrolMonitor,
  type CctvPatrolMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvPatrolsPage() {
  const [pack, setPack] = useState<CctvPatrolMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvPatrolMonitor());
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
          Checkpoint scans and unacked PATROL_MISSED. Mark-missed stays{' '}
          <Link href="/branch/patrols" className="font-semibold text-[#0078d4]">
            /branch/patrols
          </Link>{' '}
          (Control Room / Ops Mgr). CCTV Operator sees this monitor only.
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
      <h2 className="mb-2 text-sm font-semibold">Recent scans</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.scans ?? []}
        emptyMessage="No patrol scans"
        columns={[
          { key: 'siteCode', label: 'Site' },
          { key: 'method', label: 'Method' },
          {
            key: 'scannedAt',
            label: 'When',
            render: (r) => formatWhen(r.scannedAt),
          },
          { key: 'remarks', label: 'Remarks' },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold">Missed patrols</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.missedPatrols ?? []}
        emptyMessage="No open PATROL_MISSED alerts"
        columns={[
          { key: 'siteCode', label: 'Site' },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          { key: 'escalationStage', label: 'Stage' },
          { key: 'message', label: 'Message' },
          {
            key: 'createdAt',
            label: 'Raised',
            render: (r) => formatWhen(r.createdAt),
          },
        ]}
      />
    </div>
  );
}
