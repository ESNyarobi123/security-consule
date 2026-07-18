'use client';

import { checkServiceHealth } from '@pssms/api-client';
import {
  DataTable,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  btnSecondary,
} from '@pssms/ui';
import {
  CheckCircle2,
  Gauge,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const SERVICES = [
  { name: 'core-api', url: 'http://localhost:4001' },
  { name: 'reporting-service', url: 'http://localhost:4005' },
  { name: 'background-worker', url: 'http://localhost:4002', path: '/health' },
  {
    name: 'integration-gateway',
    url: 'http://localhost:4003',
    path: '/api/v1/health',
  },
  { name: 'analytics-ai', url: 'http://localhost:8001', path: '/health' },
];

const isOnline = (status?: string) =>
  !!status && status.toLowerCase() !== 'down';

const badgeStatus = (status?: string): string =>
  status === undefined ? 'PENDING' : isOnline(status) ? 'ACTIVE' : 'SUSPENDED';

type ServiceRow = {
  name: string;
  endpoint: string;
  status?: string;
};

export default function DeveloperPage() {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const runChecks = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(
      SERVICES.map(async (s) => {
        const h = await checkServiceHealth(s.url, s.path ?? '/api/v1/health');
        return [s.name, h.status] as const;
      }),
    );
    setStatuses(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  const total = SERVICES.length;
  const online = SERVICES.filter((s) => isOnline(statuses[s.name])).length;
  const offline = SERVICES.filter(
    (s) => statuses[s.name] !== undefined && !isOnline(statuses[s.name]),
  ).length;
  const availability = total > 0 ? Math.round((online / total) * 100) : 0;

  const rows: ServiceRow[] = SERVICES.map((s) => ({
    name: s.name,
    endpoint: `${s.url}${s.path ?? '/api/v1/health'}`,
    status: statuses[s.name],
  }));

  return (
    <>
      <PageHeader
        title="Developer & integrations"
        description="Live health checks across core APIs, workers, and the integration gateway."
        actions={
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking…' : 'Re-check'}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Services"
          value={total}
          hint="Monitored endpoints"
          icon={<Server className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          label="Online"
          value={online}
          hint={loading ? 'Checking…' : 'Responding to health checks'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Offline"
          value={offline}
          hint={offline > 0 ? 'Needs attention' : 'All reachable'}
          icon={<XCircle className="h-5 w-5" />}
          accent={offline > 0 ? 'rose' : 'slate'}
        />
        <StatCard
          label="Availability"
          value={`${availability}%`}
          hint="Online of monitored"
          icon={<Gauge className="h-5 w-5" />}
          accent={
            availability === 100 ? 'emerald' : availability >= 50 ? 'amber' : 'rose'
          }
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Service health</SectionTitle>
        <DataTable<ServiceRow>
          keyField="name"
          rows={rows}
          emptyMessage="No services configured"
          columns={[
            {
              key: 'name',
              label: 'Service',
              render: (row) => (
                <span className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isOnline(row.status)
                        ? 'bg-[#107c10]'
                        : row.status !== undefined
                          ? 'bg-rose-500'
                          : 'animate-pulse bg-slate-300'
                    }`}
                  />
                  <span className="font-mono text-sm font-medium text-[#1b1a19]">
                    {row.name}
                  </span>
                </span>
              ),
            },
            {
              key: 'endpoint',
              label: 'Endpoint',
              render: (row) => (
                <span className="font-mono text-xs text-[#605e5c]">
                  {row.endpoint}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={badgeStatus(row.status)} />,
            },
          ]}
        />
      </div>
    </>
  );
}
