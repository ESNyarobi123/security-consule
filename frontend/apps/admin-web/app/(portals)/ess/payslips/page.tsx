'use client';

import { listEssPayslips, type EssPayslip } from '@pssms/api-client';
import { DataTable, GlassCard, btnSecondary } from '@pssms/ui';
import { Banknote, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  formatMoney,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssPayslipsPage() {
  const [rows, setRows] = useState<EssPayslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssPayslips());
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <EssShell
      title="Payslips"
      description="Read-only pay history for your linked employee record."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<Banknote className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Banknote className="h-4 w-4" />}
                title="No payslips"
                description="Payslips appear here after payroll cycles are approved."
              />
            </div>
          ) : (
            <DataTable<EssPayslip>
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No payslips"
              columns={[
                {
                  key: 'createdAt',
                  label: 'Date',
                  render: (r) => formatDate(r.createdAt),
                },
                {
                  key: 'employeeNumber',
                  label: 'Emp #',
                  render: (r) => (
                    <span className="font-mono text-sm">
                      {r.employeeNumber}
                    </span>
                  ),
                },
                {
                  key: 'grossPay',
                  label: 'Gross',
                  render: (r) => formatMoney(r.grossPay),
                },
                {
                  key: 'totalDeductions',
                  label: 'Deductions',
                  render: (r) => formatMoney(r.totalDeductions),
                },
                {
                  key: 'netPay',
                  label: 'Net',
                  render: (r) => (
                    <span className="font-medium text-[#1b1a19]">
                      {formatMoney(r.netPay)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
