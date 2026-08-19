'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { getBranchStaffRoster, type BranchStaffRow } from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDate } from '../_components/shared';

export default function BranchStaffPage() {
  const [rows, setRows] = useState<BranchStaffRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await getBranchStaffRoster();
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
      title="Branch staff"
      description="Guards currently deployed at sites in your scope. Hire, leave, and exit stay HR. Status / readiness stays Ops Console when you have guards.manage."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-xs text-[#605e5c]">
        Deploy / end posting:{' '}
        <Link href="/branch/deployments" className="font-semibold text-[#0078d4]">
          /branch/deployments
        </Link>
        {can(getSessionUser(), 'guards.manage') ? (
          <>
            . Guard admin:{' '}
            <Link
              href="/operations/guards"
              className="font-semibold text-[#0078d4]"
            >
              /operations/guards
            </Link>
          </>
        ) : (
          '. Guard status/readiness stays Ops Console (guards.manage).'
        )}
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
        emptyMessage="No active deployments in scope"
        columns={[
          { key: 'employeeNumber', label: 'Number' },
          { key: 'fullName', label: 'Name' },
          {
            key: 'guardStatus',
            label: 'Status',
            render: (r) => <StatusBadge status={r.guardStatus} />,
          },
          { key: 'siteCode', label: 'Site' },
          { key: 'phone', label: 'Phone' },
          {
            key: 'startDate',
            label: 'On post since',
            render: (r) => formatDate(r.startDate),
          },
        ]}
      />
      {notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{notes[0]}</p>
      ) : null}
    </BranchShell>
  );
}
