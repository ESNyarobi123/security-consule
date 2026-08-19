'use client';

import {
  getComplianceAccessReview,
  type AccessReviewRow,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError, formatDateTime } from '../_components/shared';

export default function ComplianceAccessPage() {
  const [rows, setRows] = useState<AccessReviewRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await getComplianceAccessReview();
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
      title="User access monitor"
      description="Org login history for Internal Audit / CISO / DPO. Suspend, roles, MFA reset stay Super Admin."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-xs text-[#605e5c]">
        IAM console:{' '}
        <Link href="/superadmin/users" className="font-semibold text-[#0078d4]">
          /superadmin/users
        </Link>{' '}
        (users.manage).
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
        emptyMessage="No login history"
        columns={[
          { key: 'email', label: 'User' },
          { key: 'fullName', label: 'Name' },
          {
            key: 'success',
            label: 'Result',
            render: (r) => (
              <StatusBadge status={r.success ? 'SUCCESS' : 'FAILED'} />
            ),
          },
          {
            key: 'ipAddress',
            label: 'IP',
            render: (r) => r.ipAddress ?? '—',
          },
          {
            key: 'createdAt',
            label: 'When',
            render: (r) => formatDateTime(r.createdAt),
          },
        ]}
      />
      {notes[0] ? (
        <p className="mt-3 text-[11px] text-[#605e5c]">{notes[0]}</p>
      ) : null}
    </ComplianceShell>
  );
}
