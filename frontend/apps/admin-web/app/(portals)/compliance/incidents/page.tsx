'use client';

import {
  getComplianceIncidentMonitor,
  type GovernanceIncidentRow,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError, formatDateTime } from '../_components/shared';

export default function ComplianceIncidentsPage() {
  const [rows, setRows] = useState<GovernanceIncidentRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await getComplianceIncidentMonitor();
      setRows(pack.rows);
      setNotes(pack.notes);
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
    <ComplianceShell
      title="Incident reports"
      description="Read-only security incident list for governance. Investigate / close stays Branch Ops — this portal does not grant incidents.manage."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-xs text-[#605e5c]">
        Field casework:{' '}
        <Link href="/branch/incidents" className="font-semibold text-[#0078d4]">
          /branch/incidents
        </Link>{' '}
        (operations / incidents.manage). Data-breach cases stay on{' '}
        <Link href="/compliance/breaches" className="font-semibold text-[#0078d4]">
          /compliance/breaches
        </Link>
        .
      </p>
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No incidents"
        columns={[
          { key: 'incidentNumber', label: 'Number' },
          { key: 'title', label: 'Title' },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'occurredAt',
            label: 'Occurred',
            render: (r) => formatDateTime(r.occurredAt),
          },
        ]}
      />
      {notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{notes[0]}</p>
      ) : null}
    </ComplianceShell>
  );
}
