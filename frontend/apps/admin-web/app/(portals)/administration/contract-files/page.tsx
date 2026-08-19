'use client';

import { listContracts, type Contract } from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCabinet } from '../_components/FileCabinet';
import { formatApiError } from '../_components/shared';

export default function ContractFilesPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canUpload = can(session, 'documents.manage');
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listContracts());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Contract files</h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Signed agreements and attachments on contracts (documents.manage +
          contracts.manage). Commercial lifecycle stays under Contracts.
        </p>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <FileCabinet
        resourceType="Contract"
        records={rows.map((c) => ({
          id: c.id,
          title: c.contractNumber,
          subtitle: `${c.title} · ${c.status}`,
        }))}
        recordsLoading={loading}
        canUpload={canUpload}
        emptyHint="No contracts in this organization."
      />
    </div>
  );
}
