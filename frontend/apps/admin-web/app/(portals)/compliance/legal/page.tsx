'use client';

import {
  getComplianceReports,
  getRiskOptions,
  listPolicies,
  type CatalogOption,
  type ComplianceReport,
  type PolicyDocument,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import {
  DataTable,
  GlassCard,
  StatusBadge,
  btnSecondary,
} from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from '../_components/ComplianceShell';
import { formatApiError } from '../_components/shared';

export default function ComplianceLegalPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const canContracts = can(sessionUser, 'contracts.manage');
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [pack, setPack] = useState<ComplianceReport | null>(null);
  const [frames, setFrames] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, o] = await Promise.all([
        listPolicies(),
        getComplianceReports(),
        getRiskOptions(),
      ]);
      setPolicies(p.filter((x) => x.status === 'PUBLISHED'));
      setPack(r);
      setFrames(o.frameworks);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const contractEntries = Object.entries(pack?.contractsByStatus ?? {});

  return (
    <ComplianceShell
      title="Legal documents & contracts"
      description="Published policy texts and contract inventory. Legal officers edit contracts on CRM; policy publish stays Compliance Officer → GM."
      actions={
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <Link href="/compliance/policies" className="font-semibold text-[#0078d4]">
          Policy register
        </Link>
        {canContracts ? (
          <>
            <Link
              href="/superadmin/contracts"
              className="font-semibold text-[#0078d4]"
            >
              Contracts CRM
            </Link>
            <Link
              href="/administration/contract-files"
              className="font-semibold text-[#0078d4]"
            >
              Contract files
            </Link>
          </>
        ) : (
          <span className="text-[#605e5c]">
            Contract edit needs contracts.manage (LEGAL / GM). Counts below are
            still visible.
          </span>
        )}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {contractEntries.map(([status, n]) => (
          <GlassCard key={status} className="p-3">
            <p className="text-[11px] uppercase text-[#605e5c]">
              {status.replace(/_/g, ' ')}
            </p>
            <p className="text-xl font-semibold">{n}</p>
          </GlassCard>
        ))}
      </div>
      <h2 className="mb-2 text-sm font-semibold">Regulatory frameworks (catalog)</h2>
      <ul className="mb-4 grid gap-1 text-xs text-[#605e5c] sm:grid-cols-2">
        {frames.map((f) => (
          <li key={f.value}>
            <span className="font-medium text-[#323130]">{f.label}</span>
            <span className="text-[#a19f9d]"> · {f.value}</span>
          </li>
        ))}
      </ul>
      <h2 className="mb-2 text-sm font-semibold">Published policies</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={policies}
        emptyMessage="No published policies"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'title', label: 'Title' },
          {
            key: 'category',
            label: 'Domain',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
      />
    </ComplianceShell>
  );
}
