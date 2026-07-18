'use client';

import { listAuditLogs } from '@pssms/api-client';
import { DataTable, PageHeader, SectionTitle, StatCard } from '@pssms/ui';
import { Activity, Clock, Layers, ScrollText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function CompliancePage() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listAuditLogs>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listAuditLogs(30).then((logs) => {
      setRows(logs);
      setLoading(false);
    });
  }, []);

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
    <>
      <PageHeader
        title="Compliance & audit"
        description="Append-only audit trail of every privileged action across the platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        columns={[
          { key: 'action', label: 'Action' },
          { key: 'resourceType', label: 'Resource' },
          {
            key: 'resourceId',
            label: 'ID',
            render: (r) => r.resourceId ?? '—',
          },
          {
            key: 'createdAt',
            label: 'When',
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
        ]}
      />
    </>
  );
}
