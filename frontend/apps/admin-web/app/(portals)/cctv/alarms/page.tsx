'use client';

import {
  getCctvAlarmMonitor,
  type CctvAlarmMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { CameraOff, RefreshCw, Siren } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvAlarmsPage() {
  const [pack, setPack] = useState<CctvAlarmMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvAlarmMonitor());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-[#605e5c]">
          HIGH/CRITICAL field alarms (guard panic, parking gate alarms) and
          cameras that stopped reporting. Escalate or acknowledge on{' '}
          <Link href="/branch/alerts" className="font-semibold text-[#0078d4]">
            /branch/alerts
          </Link>
          . There is no separate Alarm table.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Field alarms open"
          value={pack?.fieldAlarms.length ?? '—'}
          hint="HIGH/CRITICAL, panic, parking alarms"
          tone={pack?.fieldAlarms.length ? 'rose' : 'emerald'}
          icon={<Siren className="h-4 w-4" />}
        />
        <Stat
          label="Failed camera events"
          value={pack?.failedCameraEvents.length ?? '—'}
          hint="CCTV_EVENT delivery failed"
          tone={pack?.failedCameraEvents.length ? 'amber' : 'emerald'}
          icon={<CameraOff className="h-4 w-4" />}
        />
        <Stat
          label="Panic alarms"
          value={
            pack
              ? pack.fieldAlarms.filter((a) => a.alertType === 'GUARD_EMERGENCY')
                  .length
              : '—'
          }
          hint="GUARD_EMERGENCY"
          tone="rose"
          icon={<Siren className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <h2 className="text-sm font-semibold text-[#1b1a19]">Field alarms</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.fieldAlarms ?? []}
        emptyMessage="No open field alarms"
        columns={[
          {
            key: 'alertType',
            label: 'Alarm',
            render: (r) => (
              <span className="font-medium text-[#1b1a19]">
                {r.alertType.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
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
            key: 'guardName',
            label: 'Guard',
            render: (r) => (
              <span>
                <span className="text-[12px]">{r.guardName ?? '—'}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.employeeNumber ?? ''}
                </span>
              </span>
            ),
          },
          { key: 'escalationStage', label: 'Stage' },
          { key: 'message', label: 'Message' },
          {
            key: 'createdAt',
            label: 'Raised',
            render: (r) => formatWhen(r.createdAt),
          },
        ]}
      />

      <h2 className="text-sm font-semibold text-[#1b1a19]">Failed camera events</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.failedCameraEvents ?? []}
        emptyMessage="No FAILED CCTV_EVENT rows"
        columns={[
          {
            key: 'cameraName',
            label: 'Camera',
            render: (r) => (
              <span>
                <span className="font-medium text-[#1b1a19]">
                  {r.cameraName ?? 'Unknown camera'}
                </span>
                <span className="block font-mono text-[11px] text-[#605e5c]">
                  {r.cameraCode ?? r.deviceId}
                </span>
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
                  camera {r.cameraStatus ?? 'unknown'}
                  {r.cameraLastSeenAt
                    ? ` · last seen ${formatWhen(r.cameraLastSeenAt)}`
                    : ''}
                </span>
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'error',
            label: 'Error',
            render: (r) => (
              <span className="text-[12px] text-[#a4262c]">{r.error ?? '—'}</span>
            ),
          },
          {
            key: 'receivedAt',
            label: 'When',
            render: (r) => formatWhen(r.receivedAt),
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
  tone: 'emerald' | 'amber' | 'rose';
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
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
