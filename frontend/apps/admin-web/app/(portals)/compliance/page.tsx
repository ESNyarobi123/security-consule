'use client';

import { listAuditLogs } from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  SectionTitle,
  StatCard,
  btnSecondary,
} from '@pssms/ui';
import { Activity, Clock, Layers, RefreshCw, ScrollText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComplianceShell } from './_components/ComplianceShell';
import { formatApiError, formatDateTime } from './_components/shared';

export default function ComplianceOverviewPage() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listAuditLogs>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAuditLogs(40));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const resourceTypes = new Set(rows.map((r) => r.resourceType)).size;
    const actions = new Set(rows.map((r) => r.action)).size;
    const latest = rows.reduce<number>((max, r) => {
      const t = new Date(r.createdAt).getTime();
      return Number.isNaN(t) ? max : Math.max(max, t);
    }, 0);
    return {
      events: rows.length,
      resourceTypes,
      actions,
      latestLabel: latest > 0 ? new Date(latest).toLocaleString() : '—',
      latestRelative:
        latest > 0
          ? new Date(latest).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : undefined,
    };
  }, [rows]);

  return (
    <ComplianceShell
      title="Audit overview"
      description="Append-only audit trail. Policies and the DPO breach register are under the tabs above. Risk register, DPIA, consent, and backup/DR are deferred."
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
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        Honest scope: this portal covers audit logs, policy documents (thin
        COMPLIANCE_OFFICER → GM approval), and the DPO data-breach register.
        Risk register / DPIA / consent / backup-DR are not built yet.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Events loaded"
          value={stats.events}
          hint="Most recent audit entries"
          icon={<ScrollText className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Resource types"
          value={stats.resourceTypes}
          hint="Distinct resources touched"
          icon={<Layers className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Action types"
          value={stats.actions}
          hint="Distinct operations recorded"
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Most recent"
          value={stats.latestRelative ?? '—'}
          hint={stats.events > 0 ? stats.latestLabel : 'No events yet'}
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <SectionTitle>Audit log</SectionTitle>
      <GlassCard className="!p-0 overflow-hidden">
        <DataTable
          loading={loading}
          keyField="id"
          rows={rows}
          emptyMessage="No audit events"
          columns={[
            { key: 'action', label: 'Action' },
            { key: 'resourceType', label: 'Resource' },
            {
              key: 'resourceId',
              label: 'ID',
              render: (r) => (
                <span className="font-mono text-[11px]">
                  {r.resourceId ? r.resourceId.slice(0, 8) : '—'}
                </span>
              ),
            },
            {
              key: 'actorId',
              label: 'Actor',
              render: (r) => (
                <span className="font-mono text-[11px] text-[#605e5c]">
                  {r.actorId ? r.actorId.slice(0, 8) : '—'}
                </span>
              ),
            },
            {
              key: 'createdAt',
              label: 'When',
              render: (r) => formatDateTime(r.createdAt),
            },
          ]}
        />
      </GlassCard>
    </ComplianceShell>
  );
}
