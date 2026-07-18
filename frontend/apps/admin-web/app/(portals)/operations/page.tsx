'use client';

import { listGuards, updateGuardStatus, type Guard } from '@pssms/api-client';
import {
  btnPrimary,
  btnSecondary,
  DataTable,
  GlassCard,
  Modal,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@pssms/ui';
import {
  RotateCw,
  ShieldCheck,
  Truck,
  UserX,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ReadinessBar = {
  label: string;
  count: number;
  percent: number;
  color: string;
};

export default function OperationsConsolePage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Guard | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGuards(await listGuards());
    } catch {
      setGuards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const active = guards.filter((g) => g.status === 'ACTIVE').length;
    const deployable = guards.filter((g) => g.deploymentEligible).length;
    const suspended = guards.filter((g) => g.status === 'SUSPENDED').length;
    return { total: guards.length, active, deployable, suspended };
  }, [guards]);

  const readiness: ReadinessBar[] = useMemo(() => {
    const pct = (n: number) =>
      kpis.total > 0 ? Math.round((n / kpis.total) * 100) : 0;
    return [
      {
        label: 'Active',
        count: kpis.active,
        percent: pct(kpis.active),
        color: '#107c10',
      },
      {
        label: 'Deployable',
        count: kpis.deployable,
        percent: pct(kpis.deployable),
        color: '#0078d4',
      },
      {
        label: 'Suspended',
        count: kpis.suspended,
        percent: pct(kpis.suspended),
        color: '#e11d48',
      },
    ];
  }, [kpis]);

  const nextStatus =
    target && target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

  async function confirmStatusChange() {
    if (!target) return;
    setSaving(true);
    try {
      await updateGuardStatus(target.id, nextStatus);
      setTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Operations Console"
        description="Guards, deployment eligibility, and field readiness at a glance."
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={btnSecondary}
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a href="/operations/guards" className={btnPrimary}>
              Manage guards
            </a>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total guards"
          value={kpis.total}
          hint="Registered guard profiles"
          accent="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={kpis.active}
          hint={
            kpis.total > 0
              ? `${Math.round((kpis.active / kpis.total) * 100)}% of roster`
              : 'No guards on record'
          }
          accent="emerald"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Deployable"
          value={kpis.deployable}
          hint="Eligible for field deployment"
          accent="sky"
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          label="Suspended"
          value={kpis.suspended}
          hint="Withheld from duty"
          accent="rose"
          icon={<UserX className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Fleet readiness</SectionTitle>
        <GlassCard>
          {kpis.total === 0 ? (
            <p className="text-sm text-[#605e5c]">
              Readiness breakdown appears once guard profiles are available.
            </p>
          ) : (
            <div className="space-y-4">
              {readiness.map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#323130]">
                      {bar.label}
                    </span>
                    <span className="text-[#605e5c]">
                      {bar.count.toLocaleString('en-TZ')} · {bar.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3f2f1]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${bar.percent}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="mt-8">
        <SectionTitle action={{ label: 'Open guard roster', href: '/operations/guards' }}>
          Deployment roster
        </SectionTitle>
        <DataTable<Guard>
          loading={loading}
          keyField="id"
          rows={guards}
          emptyMessage="No guard profiles on record yet."
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
                  <span className="text-[#107c10]">Yes</span>
                ) : (
                  <span className="text-[#605e5c]">No</span>
                ),
            },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <button
                  type="button"
                  onClick={() => setTarget(r)}
                  className="text-[#0067b8] hover:underline text-xs font-medium"
                >
                  {r.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                </button>
              ),
            },
          ]}
        />
      </div>

      {target ? (
        <Modal
          title={
            nextStatus === 'SUSPENDED' ? 'Suspend guard' : 'Reactivate guard'
          }
          description={`Guard ${target.employeeNumber} will be set to ${nextStatus}.`}
          onClose={() => (saving ? undefined : setTarget(null))}
        >
          <p className="text-sm text-[#323130]">
            {nextStatus === 'SUSPENDED'
              ? 'The guard will be withheld from deployment until reactivated.'
              : 'The guard will return to active status and become available for duty.'}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={saving}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmStatusChange()}
              disabled={saving}
              className={btnPrimary}
            >
              {saving
                ? 'Saving…'
                : nextStatus === 'SUSPENDED'
                  ? 'Suspend'
                  : 'Reactivate'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
