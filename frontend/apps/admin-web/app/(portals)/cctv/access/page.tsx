'use client';

import {
  getCctvAccessMonitor,
  type CctvAccessMonitor,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { LogIn, LogOut, RefreshCw, ShieldX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvAccessPage() {
  const [pack, setPack] = useState<CctvAccessMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await getCctvAccessMonitor());
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
          Customer-employee punches and visitor gate denies from the last 24
          hours, with the person, gate and customer site attached. Guard
          attendance stays in attendance.* — it is not mixed in here.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Check-ins (24h)"
          value={pack?.checkIns24h ?? '—'}
          hint="Customer employees"
          tone="sky"
          icon={<LogIn className="h-4 w-4" />}
        />
        <Stat
          label="Check-outs (24h)"
          value={pack?.checkOuts24h ?? '—'}
          hint="Customer employees"
          tone="emerald"
          icon={<LogOut className="h-4 w-4" />}
        />
        <Stat
          label="Visitor gate denies"
          value={pack?.visitorDenies24h ?? '—'}
          hint="Wrong / expired / used / blacklisted"
          tone={pack?.visitorDenies24h ? 'rose' : 'slate'}
          icon={<ShieldX className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <h2 className="text-sm font-semibold text-[#1b1a19]">
        Customer employee punches
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.accessEntries ?? []}
        emptyMessage="No access punches in the last 24 hours"
        columns={[
          {
            key: 'employeeName',
            label: 'Employee',
            render: (r) => (
              <span>
                <span className="font-medium text-[#1b1a19]">
                  {r.employeeName ?? 'Unknown employee'}
                </span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.employeeNumber ?? r.employeeId}
                </span>
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
                    : 'no gate recorded'}
                </span>
              </span>
            ),
          },
          {
            key: 'entryType',
            label: 'Punch',
            render: (r) => <StatusBadge status={r.entryType} />,
          },
          { key: 'accessMethod', label: 'Method' },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
          },
        ]}
      />

      <h2 className="text-sm font-semibold text-[#1b1a19]">
        Visitor gate denies
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={pack?.visitorDenies ?? []}
        emptyMessage="No visitor denies in the last 24 hours"
        columns={[
          {
            key: 'visitorName',
            label: 'Visitor',
            render: (r) => (
              <span>
                <span className="font-medium text-[#1b1a19]">{r.visitorName}</span>
                <span className="block text-[11px] text-[#605e5c]">
                  {r.referenceNumber ?? 'no appointment'}
                  {r.visitorPhone ? ` · ${r.visitorPhone}` : ''}
                </span>
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
                  {r.gateCode ?? 'no gate'}
                </span>
              </span>
            ),
          },
          { key: 'direction', label: 'Dir' },
          {
            key: 'result',
            label: 'Result',
            render: (r) => <StatusBadge status={r.result} />,
          },
          {
            key: 'denyReason',
            label: 'Reason',
            render: (r) => (
              <span>
                <span className="text-[12px] text-[#a4262c]">
                  {(r.denyReason ?? '—').replace(/_/g, ' ')}
                </span>
                {r.hostName ? (
                  <span className="block text-[11px] text-[#605e5c]">
                    host: {r.hostName}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'recordedAt',
            label: 'When',
            render: (r) => formatWhen(r.recordedAt),
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
