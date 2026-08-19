'use client';

import { listEssAttendance, type EssAttendancePack } from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { Clock, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EssAttendancePage() {
  const [pack, setPack] = useState<EssAttendancePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setPack(await listEssAttendance());
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setPack(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <EssShell
      title="Attendance"
      description="Your own duty punches. Guard clock-in is recorded here when HR linked a guard profile. Office timekeeping is not a separate module yet."
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
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<Clock className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <>
          {pack?.note ? (
            <p className="mb-3 rounded border border-[#cfe4f7] bg-[#f3f9fd] px-3 py-2 text-xs text-[#323130]">
              {pack.note}
            </p>
          ) : null}
          <GlassCard className="!p-0 overflow-hidden">
            {(pack?.rows.length ?? 0) === 0 && !loading ? (
              <div className="p-4">
                <PanelEmpty
                  icon={<Clock className="h-4 w-4" />}
                  title="No attendance rows"
                  description={
                    pack?.source === 'NONE'
                      ? 'Ask HR to link a guard profile if you clock on sites. Field punch stays on the Guard app.'
                      : 'No clock-in records in the last 40 punches.'
                  }
                />
              </div>
            ) : (
              <DataTable
                loading={loading}
                keyField="id"
                rows={pack?.rows ?? []}
                emptyMessage="No attendance"
                columns={[
                  {
                    key: 'clockInAt',
                    label: 'Clock in',
                    render: (r) => formatTime(r.clockInAt),
                  },
                  {
                    key: 'clockOutAt',
                    label: 'Clock out',
                    render: (r) => formatTime(r.clockOutAt),
                  },
                  {
                    key: 'siteName',
                    label: 'Site',
                    render: (r) => r.siteName ?? r.siteCode ?? '—',
                  },
                  {
                    key: 'clockInMethod',
                    label: 'Method',
                    render: (r) => (
                      <span className="text-xs">{r.clockInMethod}</span>
                    ),
                  },
                  {
                    key: 'supervisorApproved',
                    label: 'Supervisor',
                    render: (r) => (
                      <StatusBadge
                        status={r.supervisorApproved ? 'APPROVED' : 'PENDING'}
                      />
                    ),
                  },
                  {
                    key: 'id',
                    label: 'Date',
                    render: (r) => formatDate(r.clockInAt),
                  },
                ]}
              />
            )}
          </GlassCard>
        </>
      )}
    </EssShell>
  );
}
