'use client';

import {
  getCctvIncidentMonitor,
  type CctvIncidentMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvIncidentsPage() {
  const [pack, setPack] = useState<CctvIncidentMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvIncidentMonitor());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = pack?.rows ?? [];
  const fromAiAlert = (r: { category: string; clientEventId?: string | null }) =>
    r.category === 'CCTV_ALERT' || Boolean(r.clientEventId?.startsWith('device-event:'));
  const aiRows = rows.filter(fromAiAlert);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-[#605e5c]">
          Open / investigating security incidents across your sites (read-only).
          Record one from an AI alert; triage and close stay on{' '}
          <Link href="/branch/incidents" className="font-semibold text-[#0078d4]">
            /branch/incidents
          </Link>
          . CCTV monitoring does not get incidents.manage.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Open incidents"
          value={rows.length}
          hint="OPEN + INVESTIGATING"
          tone="sky"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <Stat
          label="Critical"
          value={rows.filter((r) => r.severity === 'CRITICAL').length}
          hint="Needs senior attention"
          tone={rows.some((r) => r.severity === 'CRITICAL') ? 'rose' : 'emerald'}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <Stat
          label="From AI alerts"
          value={aiRows.length}
          hint="Raised from a camera event"
          tone="amber"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No open incidents"
        columns={[
          {
            key: 'incidentNumber',
            label: 'Number',
            render: (r) => (
              <span className="font-mono text-[12px] font-semibold">
                {r.incidentNumber}
              </span>
            ),
          },
          {
            key: 'title',
            label: 'Title',
            render: (r) => (
              <span>
                <span className="text-[12px] font-medium text-[#1b1a19]">
                  {r.title}
                </span>
                {fromAiAlert(r) ? (
                  <span className="block text-[11px] text-[#0078d4]">
                    raised from AI alert
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'siteCode',
            label: 'Site',
            render: (r) => (
              <span>
                <span className="font-mono text-[12px]">{r.siteCode ?? '—'}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.siteName ?? ''}
                </span>
              </span>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            render: (r) => r.category.replace(/_/g, ' '),
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'occurredAt',
            label: 'Occurred',
            render: (r) => formatWhen(r.occurredAt),
          },
        ]}
      />
      {pack?.notes[0] ? (
        <p className="text-[11px] text-[#605e5c]">{pack.notes[0]}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: 'sky' | 'emerald' | 'rose' | 'amber';
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
          {label}
        </p>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
      <p className="text-[11px] opacity-70">{hint}</p>
    </div>
  );
}
