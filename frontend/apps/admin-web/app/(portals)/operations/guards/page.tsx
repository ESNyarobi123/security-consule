'use client';

import { listGuards, updateGuardStatus, type Guard } from '@pssms/api-client';
import {
  DataTable,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  btnSecondary,
} from '@pssms/ui';
import {
  BadgeCheck,
  Rocket,
  Shield,
  ShieldOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function OperationsGuardsPage() {
  const [rows, setRows] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listGuards());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSuspend(guard: Guard) {
    const next = guard.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await updateGuardStatus(guard.id, next);
    await load();
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'ACTIVE').length;
    const deployable = rows.filter((r) => r.deploymentEligible).length;
    const suspended = rows.filter((r) => r.status === 'SUSPENDED').length;
    return { total, active, deployable, suspended };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Security guards"
        description="Guard profiles and deployment eligibility"
        actions={
          <a href="/operations" className={btnSecondary}>
            ← Ops Console
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total guards"
          value={stats.total}
          hint="Registered profiles"
          icon={<Shield className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Active"
          value={stats.active}
          hint={
            stats.total > 0
              ? `${Math.round((stats.active / stats.total) * 100)}% of roster`
              : 'No guards yet'
          }
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Deployable"
          value={stats.deployable}
          hint="Eligible for deployment"
          icon={<Rocket className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          hint="Not in service"
          icon={<ShieldOff className="h-5 w-5" />}
          accent="rose"
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Guard registry</SectionTitle>
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
          emptyMessage="No guards registered yet."
          columns={[
            { key: 'employeeNumber', label: 'Guard #' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'deploymentEligible',
              label: 'Deployable',
              render: (r) =>
                r.deploymentEligible ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#dff6dd] px-2 py-0.5 text-[11px] font-medium text-[#107c10]">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#605e5c]">
                    No
                  </span>
                ),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <button
                  type="button"
                  onClick={() => void toggleSuspend(r)}
                  className={
                    r.status === 'ACTIVE'
                      ? 'text-xs font-medium text-rose-600 hover:underline'
                      : 'text-xs font-medium text-[#0067b8] hover:underline'
                  }
                >
                  {r.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                </button>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
