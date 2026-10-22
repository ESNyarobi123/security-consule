'use client';

import {
  getCctvParkingMonitor,
  type CctvParkingMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { CarFront, CircleParking, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvParkingPage() {
  const [pack, setPack] = useState<CctvParkingMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvParkingMonitor());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const occ = pack?.occupancy;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-[#605e5c]">
          Gate entries/exits, open violations and patrol observations across
          your parking areas, with gate, driver and purpose attached. Permit
          issue, billing and approvals stay in the parking operations portal —
          this is the read-only monitoring surface.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Occupied bays"
          value={occ ? `${occ.occupied}/${occ.spacesActive}` : '—'}
          hint={
            occ?.utilizationPct != null
              ? `${occ.utilizationPct}% utilisation`
              : 'No active parking spaces'
          }
          tone="sky"
          icon={<CircleParking className="h-4 w-4" />}
        />
        <Stat
          label="Entries (24h)"
          value={pack?.entries.filter((e) => e.direction === 'ENTRY').length ?? '—'}
          hint={`${pack?.entries.length ?? 0} movements sampled`}
          tone="emerald"
          icon={<CarFront className="h-4 w-4" />}
        />
        <Stat
          label="Open violations"
          value={pack?.openViolations.length ?? '—'}
          hint="Corrective action / pending closure"
          tone={pack?.openViolations.length ? 'amber' : 'slate'}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <Stat
          label="Patrol observations"
          value={pack?.patrolObservations.length ?? '—'}
          hint="Parking patrol notes"
          tone="slate"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <h2 className="text-sm font-semibold text-[#1b1a19]">Gate movements (24h)</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.entries ?? []}
        emptyMessage="No parking entries in the last 24 hours"
        columns={[
          {
            key: 'plateNumber',
            label: 'Plate',
            render: (r) => (
              <span className="font-mono font-semibold tracking-wide">
                {r.plateNumber}
              </span>
            ),
          },
          {
            key: 'siteCode',
            label: 'Site / gate',
            render: (r) => (
              <span>
                <span className="font-mono text-[12px]">{r.siteCode ?? '—'}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.gateCode
                    ? `${r.gateCode}${r.gateName ? ` · ${r.gateName}` : ''}`
                    : 'no gate'}
                </span>
              </span>
            ),
          },
          { key: 'direction', label: 'Dir' },
          {
            key: 'decision',
            label: 'Decision',
            render: (r) => <StatusBadge status={r.decision} />,
          },
          {
            key: 'driverName',
            label: 'Driver / purpose',
            render: (r) => (
              <span>
                <span className="text-[12px]">{r.driverName ?? '—'}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.purposeOfVisit ?? 'no purpose recorded'}
                </span>
              </span>
            ),
          },
          { key: 'verificationMethod', label: 'Method' },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
          },
        ]}
      />

      <h2 className="text-sm font-semibold text-[#1b1a19]">Open violations</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.openViolations ?? []}
        emptyMessage="No open violations"
        columns={[
          {
            key: 'plateNumber',
            label: 'Plate',
            render: (r) => (
              <span className="font-mono font-semibold">{r.plateNumber}</span>
            ),
          },
          { key: 'siteCode', label: 'Site' },
          {
            key: 'violationType',
            label: 'Type',
            render: (r) => r.violationType.replace(/_/g, ' '),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'description',
            label: 'Details',
            render: (r) => (
              <span className="text-[12px] text-[#605e5c]">
                {r.officerRemarks ?? r.description ?? '—'}
              </span>
            ),
          },
          {
            key: 'createdAt',
            label: 'Raised',
            render: (r) => formatWhen(r.createdAt),
          },
        ]}
      />

      <h2 className="text-sm font-semibold text-[#1b1a19]">
        Parking patrol notes
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.patrolObservations ?? []}
        emptyMessage="No parking patrol observations"
        columns={[
          { key: 'parkingArea', label: 'Area' },
          { key: 'siteCode', label: 'Site' },
          {
            key: 'observationType',
            label: 'Type',
            render: (r) => r.observationType.replace(/_/g, ' '),
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => <StatusBadge status={r.severity} />,
          },
          { key: 'plateNumber', label: 'Plate' },
          {
            key: 'notes',
            label: 'Notes',
            render: (r) => (
              <span className="text-[12px] text-[#605e5c]">{r.notes ?? '—'}</span>
            ),
          },
          {
            key: 'inspectedAt',
            label: 'When',
            render: (r) => formatWhen(r.inspectedAt),
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
  tone: 'sky' | 'emerald' | 'amber' | 'slate';
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
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
