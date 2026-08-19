'use client';

import {
  accrueMarketingCommission,
  listMarketingCommissions,
  type MarketingCommission,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

const fmtTZS = (n: number) =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);

export default function MarketingCommissionsPage() {
  const [rows, setRows] = useState<MarketingCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMarketingCommissions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#605e5c]">
        Referral commissions are a register only. Accrue here (creator cannot
        accrue their own row); payment stays on Portal 35.15 (Finance). No
        payroll deduction in this slice.
      </p>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <DataTable
        loading={loading}
        rows={rows}
        keyField="id"
        emptyMessage="No commissions yet — mark a lead won with a beneficiary and amount."
        columns={[
          { key: 'leadCode', label: 'Lead', render: (r) => r.leadCode ?? r.leadId },
          { key: 'companyName', label: 'Company', render: (r) => r.companyName ?? '—' },
          { key: 'beneficiary', label: 'Beneficiary' },
          {
            key: 'amount',
            label: 'Amount',
            render: (r) => fmtTZS(r.amount),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'id',
            label: '',
            render: (r) =>
              r.status === 'PENDING' ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() =>
                    void accrueMarketingCommission(r.id)
                      .then(() => load())
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : 'Accrue failed'),
                      )
                  }
                >
                  Accrue
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  );
}
