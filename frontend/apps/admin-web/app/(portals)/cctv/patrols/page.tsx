'use client';

import {
  getCctvPatrolMonitor,
  type CctvPatrolMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { Footprints, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatAge, formatApiError, formatWhen } from '../_components/shared';

export default function CctvPatrolsPage() {
  const [pack, setPack] = useState<CctvPatrolMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvPatrolMonitor());
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
          Checkpoint scans with guard, checkpoint name and zone, plus unacked
          PATROL_MISSED alarms. Mark-missed and route SLA stay on{' '}
          <Link href="/branch/patrols" className="font-semibold text-[#0078d4]">
            /branch/patrols
          </Link>
          .
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Scans sampled"
          value={pack?.scans.length ?? '—'}
          hint="Latest checkpoint scans"
          tone="sky"
          icon={<Footprints className="h-4 w-4" />}
        />
        <Stat
          label="Missed patrols"
          value={pack?.missedPatrols.length ?? '—'}
          hint="Unacknowledged PATROL_MISSED"
          tone={pack?.missedPatrols.length ? 'rose' : 'emerald'}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <Stat
          label="Distinct checkpoints"
          value={
            pack
              ? new Set(
                  pack.scans.map((s) => s.checkpointCode ?? s.checkpointId),
                ).size
              : '—'
          }
          hint="Coverage in the sample"
          tone="slate"
          icon={<Footprints className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <h2 className="text-sm font-semibold text-[#1b1a19]">Recent scans</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.scans ?? []}
        emptyMessage="No patrol scans"
        columns={[
          {
            key: 'guardName',
            label: 'Guard',
            render: (r) => (
              <span>
                <span className="font-medium text-[#1b1a19]">
                  {r.guardName ?? 'Guard'}
                </span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.employeeNumber ?? r.guardId}
                </span>
              </span>
            ),
          },
          {
            key: 'checkpointName',
            label: 'Checkpoint',
            render: (r) => (
              <span>
                <span className="font-mono text-[12px]">
                  {r.checkpointCode ?? '—'}
                </span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.checkpointName ?? 'unnamed'}
                  {r.checkpointZone ? ` · ${r.checkpointZone}` : ''}
                </span>
              </span>
            ),
          },
          { key: 'siteCode', label: 'Site' },
          { key: 'method', label: 'Method' },
          {
            key: 'scannedAt',
            label: 'When',
            render: (r) => (
              <span>
                <span className="text-[12px]">{formatWhen(r.scannedAt)}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {formatAge(
                    Math.max(
                      0,
                      Math.round(
                        (Date.now() - new Date(r.scannedAt).getTime()) / 60000,
                      ),
                    ),
                  )}
                </span>
              </span>
            ),
          },
          { key: 'remarks', label: 'Remarks' },
        ]}
      />

      <h2 className="text-sm font-semibold text-[#1b1a19]">Missed patrols</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.missedPatrols ?? []}
        emptyMessage="No open PATROL_MISSED alerts"
        columns={[
          { key: 'siteCode', label: 'Site' },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
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
  tone: 'sky' | 'emerald' | 'rose' | 'slate';
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
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
