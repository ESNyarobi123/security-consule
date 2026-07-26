'use client';

import {
  acknowledgeFieldAlert,
  listAttendance,
  listFieldAlerts,
  listGuards,
  listPendingAlertness,
  listSites,
  type AttendanceRecord,
  type FieldAlert,
  type Guard,
  type PendingAlertness,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  SectionTitle,
  StatusBadge,
  btnPrimary,
  btnSecondary,
} from '@pssms/ui';
import { Bell, Clock3, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  formatApiError,
  formatDateTime,
  shortId,
} from '../_components/shared';

function localDayBounds(d = new Date()) {
  const from = new Date(d);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

type AttendanceRow = AttendanceRecord & { dutyStatus: string };

function dutyStatus(row: AttendanceRecord) {
  if (!row.clockOutAt) return 'ON_DUTY';
  return 'CLOCKED_OUT';
}

export default function BranchAttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [pending, setPending] = useState<PendingAlertness[]>([]);
  const [alerts, setAlerts] = useState<FieldAlert[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = localDayBounds();
      const attParams: {
        siteId?: string;
        from: string;
        to: string;
      } = { from, to };
      if (siteId) attParams.siteId = siteId;

      const alertParams: { siteId?: string; acknowledged: boolean } = {
        acknowledged: false,
      };
      if (siteId) alertParams.siteId = siteId;

      const [att, pend, openAlerts, g, s] = await Promise.all([
        listAttendance(attParams),
        listPendingAlertness(),
        listFieldAlerts(alertParams),
        listGuards(),
        listSites(),
      ]);
      setRows(
        att.map((r) => ({ ...r, dutyStatus: dutyStatus(r) })),
      );
      setPending(
        siteId ? pend.filter((p) => p.siteId === siteId) : pend,
      );
      setAlerts(openAlerts);
      setGuards(g);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guardLabel = useMemo(() => {
    const map = new Map(guards.map((g) => [g.id, g.employeeNumber]));
    return (id?: string | null) => {
      if (!id) return '—';
      return map.get(id) ?? shortId(id);
    };
  }, [guards]);

  const siteLabel = useMemo(() => {
    const map = new Map(sites.map((s) => [s.id, s.code]));
    return (id: string) => map.get(id) ?? shortId(id);
  }, [sites]);

  async function onAck(id: string) {
    setAckingId(id);
    setError(null);
    try {
      await acknowledgeFieldAlert(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setAckingId(null);
    }
  }

  return (
    <BranchShell
      title="Attendance board"
      description="Today’s guard clock events and open alertness / field escalations for BOM supervision (operations.manage)."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Site
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="rounded border border-[#e1dfdd] bg-white px-2 py-1 text-xs text-[#323130]"
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
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
        </>
      }
    >
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        Honest scope: data from GET /attendance (today) + alertness/pending +
        field-alerts. Live SSE deferred — refresh manually. Patrols under Branch → Patrols.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <SectionTitle>Today — clock in / out</SectionTitle>
      <GlassCard className="mb-6 !p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <Clock3 className="h-5 w-5 text-[#a19f9d]" />
            <p>No attendance clocked today for this filter</p>
          </div>
        ) : (
          <DataTable<AttendanceRow>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No attendance"
            columns={[
              {
                key: 'guardId',
                label: 'Guard',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {guardLabel(r.guardId)}
                  </span>
                ),
              },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r.siteId),
              },
              {
                key: 'dutyStatus',
                label: 'Status',
                render: (r) => <StatusBadge status={r.dutyStatus} />,
              },
              {
                key: 'clockInAt',
                label: 'Clock in',
                render: (r) => formatDateTime(r.clockInAt),
              },
              {
                key: 'clockOutAt',
                label: 'Clock out',
                render: (r) => formatDateTime(r.clockOutAt),
              },
              {
                key: 'supervisorApproved',
                label: 'Approved',
                render: (r) =>
                  r.supervisorApproved ? (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Yes
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">No</span>
                  ),
              },
              {
                key: 'syncStatus',
                label: 'Sync',
                render: (r) => (
                  <span className="font-mono text-[11px]">{r.syncStatus}</span>
                ),
              },
            ]}
          />
        )}
      </GlassCard>

      <SectionTitle>Pending alertness</SectionTitle>
      <GlassCard className="mb-6 !p-0 overflow-hidden">
        {pending.length === 0 && !loading ? (
          <div className="px-4 py-8 text-center text-sm text-[#605e5c]">
            No scheduled alertness checks pending
          </div>
        ) : (
          <DataTable<PendingAlertness>
            loading={loading}
            keyField="id"
            rows={pending}
            emptyMessage="No pending alertness"
            columns={[
              {
                key: 'referenceNumber',
                label: 'Ref',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {r.referenceNumber ?? shortId(r.id)}
                  </span>
                ),
              },
              {
                key: 'guardId',
                label: 'Guard',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {guardLabel(r.guardId)}
                  </span>
                ),
              },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r.siteId),
              },
              {
                key: 'scheduledAt',
                label: 'Scheduled',
                render: (r) => formatDateTime(r.scheduledAt),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
            ]}
          />
        )}
      </GlassCard>

      <SectionTitle>Open field alerts</SectionTitle>
      <GlassCard className="!p-0 overflow-hidden">
        {alerts.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <Bell className="h-5 w-5 text-[#a19f9d]" />
            <p>No open field alerts</p>
          </div>
        ) : (
          <DataTable<FieldAlert>
            loading={loading}
            keyField="id"
            rows={alerts}
            emptyMessage="No alerts"
            columns={[
              {
                key: 'severity',
                label: 'Severity',
                render: (r) => <StatusBadge status={r.severity} />,
              },
              { key: 'alertType', label: 'Type' },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r.siteId),
              },
              {
                key: 'guardId',
                label: 'Guard',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {guardLabel(r.guardId)}
                  </span>
                ),
              },
              {
                key: 'message',
                label: 'Message',
                render: (r) => (
                  <span className="line-clamp-2 max-w-xs text-xs">
                    {r.message}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'When',
                render: (r) => formatDateTime(r.createdAt),
              },
              {
                key: 'acknowledged',
                label: '',
                render: (r) => (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={ackingId === r.id}
                    onClick={() => void onAck(r.id)}
                  >
                    {ackingId === r.id ? '…' : 'Acknowledge'}
                  </button>
                ),
              },
            ]}
          />
        )}
      </GlassCard>
    </BranchShell>
  );
}
