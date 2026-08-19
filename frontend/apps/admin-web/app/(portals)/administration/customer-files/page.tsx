'use client';

import { listCustomers, type Customer } from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCabinet } from '../_components/FileCabinet';
import { formatApiError } from '../_components/shared';

export default function CustomerFilesPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canUpload = can(session, 'documents.manage');
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCustomers());
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
        <h1 className="text-xl font-semibold text-[#1b1a19]">Customer files</h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Attachments on customer records via shared documents + MinIO
          (documents.manage + customers.manage). CRM profile stays under
          Customers.
        </p>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <FileCabinet
        resourceType="Customer"
        records={rows.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: `${c.code}${c.status ? ` · ${c.status}` : ''}`,
        }))}
        recordsLoading={loading}
        canUpload={canUpload}
        emptyHint="No customers in this organization."
      />
    </div>
  );
}
