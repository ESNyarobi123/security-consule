'use client';

import { listEmployees, type Employee } from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, btnSecondary } from '@pssms/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCabinet } from '../_components/FileCabinet';
import { formatApiError } from '../_components/shared';

/**
 * Portal 35.3 — Staff files.
 *
 * `hr.manage` reads the whole company register. A Branch Manager holds
 * `hr.branch` instead, so the API returns only their own branch's staff and
 * staff-file attachments are limited to those employees (no cross-branch leak).
 */
export default function StaffFilesPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canHr = can(session, 'hr.manage');
  const canBranchHr = can(session, 'hr.branch');
  const canList = canHr || canBranchHr;
  const canUpload = can(session, 'documents.manage') && canList;
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(canList);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canList) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await listEmployees());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canList]);

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

      {!canList ? (
        <GlassCard glow="none" className="p-4">
          <p className="text-sm text-[#605e5c]">
            Staff files are limited to HR officers and Branch Managers. Ask HR
            if you need a copy of a staff document.
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard glow="none" className="px-4 py-3">
            <p className="text-sm text-[#605e5c]">
              {canHr ? (
                <>
                  You are viewing the <strong>company-wide</strong> staff
                  register. Edit profiles, status, and ESS links in HR.
                </>
              ) : (
                <>
                  You are viewing <strong>your branch&apos;s</strong> staff
                  register. Only employees posted to your branch appear here —
                  another branch&apos;s staff files stay out of scope.
                </>
              )}
            </p>
          </GlassCard>

          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          {canHr ? (
            <div className="flex items-center justify-end">
              <Link href="/hr/employees" className={btnSecondary}>
                Manage in HR
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Link href="/branch/staff" className={btnSecondary}>
                Manage branch staff
              </Link>
            </div>
          )}

          <FileCabinet
            resourceType="Employee"
            records={rows.map((e) => ({
              id: e.id,
              title: e.fullName,
              subtitle: `${e.employeeNumber}${e.department ? ` · ${e.department}` : ''} · ${e.status}`,
            }))}
            recordsLoading={loading}
            canUpload={canUpload}
            emptyHint={
              canHr
                ? 'No employees in this organization.'
                : 'No employees are posted to your branch yet.'
            }
          />

          {!canUpload ? (
            <p className="text-xs text-[#605e5c]">
              Uploading staff files needs `documents.manage`. You can still
              list and open existing files.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
