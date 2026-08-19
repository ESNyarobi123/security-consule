'use client';

import {
  getBranchInspections,
  type BranchInspectionRow,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime } from '../_components/shared';

export default function BranchInspectionsPage() {
  const [rows, setRows] = useState<BranchInspectionRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await getBranchInspections();
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
    <BranchShell
      title="Inspections"
      description="Supervisor comments and handover notes from the occurrence book. Record and second-person approve stay on EOB (recorder ≠ approver)."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-xs text-[#605e5c]">
        Write an inspection:{' '}
        <Link href="/branch/eob" className="font-semibold text-[#0078d4]">
          /branch/eob
        </Link>{' '}
        (category SUPERVISOR_COMMENT or HANDOVER_NOTE).
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
        emptyMessage="No inspection notes in scope"
        columns={[
          {
            key: 'category',
            label: 'Type',
            render: (r) => <StatusBadge status={r.category} />,
          },
          { key: 'siteCode', label: 'Site' },
          { key: 'officerName', label: 'Officer' },
          { key: 'description', label: 'Note' },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatDateTime(r.recordedAt),
          },
        ]}
      />
      {notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{notes[0]}</p>
      ) : null}
    </BranchShell>
  );
}
