'use client';

import { listEmployees, type Employee } from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, btnSecondary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCabinet } from '../_components/FileCabinet';
import { formatApiError } from '../_components/shared';

export default function StaffFilesPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canHr = can(session, 'hr.manage');
  const canUpload = can(session, 'documents.manage') && canHr;
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(canHr);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canHr) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmployees());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canHr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Staff files</h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Company employee register and MinIO staff papers (`Employee`
          attachments). HR owns profile, leave, and movements. Do not store
          staff papers on customer or contract records.
        </p>
      </div>

      {!canHr ? (
        <GlassCard glow="none" className="p-4">
          <p className="text-sm text-[#605e5c]">
            Listing staff files requires hr.manage. Branch Managers can send
            officers to HR; Department Heads and GM can open the register.
          </p>
          <Link href="/hr/employees" className={`${btnSecondary} mt-3 inline-flex`}>
            Open HR employees
          </Link>
        </GlassCard>
      ) : (
        <>
          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end">
            <Link href="/hr/employees" className={btnSecondary}>
              Manage in HR
            </Link>
          </div>
          <FileCabinet
            resourceType="Employee"
            records={rows.map((e) => ({
              id: e.id,
              title: e.fullName,
              subtitle: `${e.employeeNumber}${e.department ? ` · ${e.department}` : ''} · ${e.status}`,
            }))}
            recordsLoading={loading}
            canUpload={canUpload}
            emptyHint="No employees in this organization."
          />
        </>
      )}
    </div>
  );
}
