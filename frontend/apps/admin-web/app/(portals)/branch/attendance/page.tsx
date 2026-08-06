'use client';

import {
  acknowledgeFieldAlert,
  approveAttendance,
  escalateFieldAlert,
  listAlertnessHistory,
  listAttendance,
  listFieldAlerts,
  listGuards,
  listPendingAlertness,
  listSites,
  markAlertnessMissed,
  scanMissedAlertness,
  scheduleAlertness,
  supervisorClockIn,
  type AlertnessHistoryRow,
  type AttendanceRecord,
  type FieldAlert,
  type Guard,
  type PendingAlertness,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  SectionTitle,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { AlarmClock, Bell, Clock3, LogIn, Plus, RefreshCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
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

function plusMinutesLocalIso(minutes: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string) {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

type AttendanceRow = AttendanceRecord & { dutyStatus: string };

function dutyStatus(row: AttendanceRecord) {
  if (!row.clockOutAt) return 'ON_DUTY';
  return 'CLOCKED_OUT';
}

export default function BranchAttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [pending, setPending] = useState<PendingAlertness[]>([]);
  const [history, setHistory] = useState<AlertnessHistoryRow[]>([]);
  const [alerts, setAlerts] = useState<FieldAlert[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  /** '' = all · 'false' = pending · 'true' = approved */
  const [approvedFilter, setApprovedFilter] = useState('');
  const [geofenceFilter, setGeofenceFilter] = useState(false);
  /** Module 10-C — history status filter (empty = completed set) */
  const [historyStatus, setHistoryStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [clockInOpen, setClockInOpen] = useState(false);
  const [formGuardId, setFormGuardId] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formAt, setFormAt] = useState(() => plusMinutesLocalIso(30));
  const [formClockInGuardId, setFormClockInGuardId] = useState('');
  const [formClockInSiteId, setFormClockInSiteId] = useState('');
  const [formClockInRemarks, setFormClockInRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [clockInSaving, setClockInSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = localDayBounds();
      const attParams: {
        siteId?: string;
        supervisorApproved?: boolean;
        from: string;
        to: string;
      } = { from, to };
      if (siteId) attParams.siteId = siteId;
      if (approvedFilter === 'true') attParams.supervisorApproved = true;
      if (approvedFilter === 'false') attParams.supervisorApproved = false;

      const alertParams: { siteId?: string; acknowledged: boolean } = {
        acknowledged: false,
      };
      if (siteId) alertParams.siteId = siteId;

      const histParams: {
        siteId?: string;
        status?: string;
        from: string;
        to: string;
        take: number;
      } = { from, to, take: 40 };
      if (siteId) histParams.siteId = siteId;
      if (historyStatus) histParams.status = historyStatus;

      const [att, pend, hist, openAlerts, g, s] = await Promise.all([
        listAttendance(attParams),
        listPendingAlertness(),
        listAlertnessHistory(histParams),
        listFieldAlerts(alertParams),
        listGuards(),
        listSites(),
      ]);
      setRows(att.map((r) => ({ ...r, dutyStatus: dutyStatus(r) })));
      setPending(siteId ? pend.filter((p) => p.siteId === siteId) : pend);
      setHistory(hist);
      setAlerts(openAlerts);
      setGuards(g);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [siteId, approvedFilter, historyStatus]);

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

  const overduePending = useMemo(() => {
    const now = Date.now();
    return new Set(
      pending.filter((p) => new Date(p.scheduledAt).getTime() < now).map((p) => p.id),
    );
  }, [pending]);

  const displayRows = useMemo(() => {
    if (!geofenceFilter) return rows;
    return rows.filter((r) => r.geofenceWarning);
  }, [rows, geofenceFilter]);

  function hasNoGps(row: AttendanceRecord) {
    return (row.remarks ?? '').includes('NO_GPS');
  }

  async function onEscalate(id: string) {
    setEscalatingId(id);
    setError(null);
    try {
      await escalateFieldAlert(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setEscalatingId(null);
    }
  }

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

  async function onMarkMissed(id: string) {
    let supervisorRemarks: string | undefined;
    if (typeof window !== 'undefined') {
      const entered = window.prompt(
        'Mark this alertness check missed? Optional supervisor remarks:',
        '',
      );
      if (entered === null) return;
      supervisorRemarks = entered.trim() || undefined;
    }
    setBusyId(id);
    setError(null);
    setInfo(null);
    try {
      await markAlertnessMissed(id, { supervisorRemarks });
      setInfo(
        supervisorRemarks
          ? 'Marked missed with remarks — FieldAlert ALERTNESS_MISSED raised.'
          : 'Marked missed — FieldAlert ALERTNESS_MISSED raised for ops queue.',
      );
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onScanMissed() {
    setScanning(true);
    setError(null);
    setInfo(null);
    try {
      const res = await scanMissedAlertness(0);
      await refresh();
      if (res.markedMissed === 0) {
        setInfo('Scan complete — no past-due SCHEDULED checks.');
      } else {
        setInfo(
          `Auto-missed ${res.markedMissed}: ${res.referenceNumbers.join(', ') || 'checks'} → FieldAlert`,
        );
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setScanning(false);
    }
  }

  function openSchedule() {
    setFormGuardId(guards[0]?.id ?? '');
    setFormSiteId(siteId || sites[0]?.id || '');
    setFormAt(plusMinutesLocalIso(30));
    setScheduleOpen(true);
  }

  function openSupervisorClockIn() {
    setFormClockInGuardId(guards[0]?.id ?? '');
    setFormClockInSiteId(siteId || sites[0]?.id || '');
    setFormClockInRemarks('');
    setClockInOpen(true);
  }

  async function submitSupervisorClockIn(e: FormEvent) {
    e.preventDefault();
    if (!formClockInGuardId || !formClockInSiteId) return;
    setClockInSaving(true);
    setError(null);
    setInfo(null);
    try {
      const created = await supervisorClockIn({
        guardId: formClockInGuardId,
        siteId: formClockInSiteId,
        ...(formClockInRemarks.trim()
          ? { remarks: formClockInRemarks.trim() }
          : {}),
      });
      setClockInOpen(false);
      setInfo(
        `Supervisor clock-in recorded for ${guardLabel(created.guardId)}${created.alertnessChecksScheduled ? ` — ${created.alertnessChecksScheduled} alertness check(s) scheduled` : ''}.`,
      );
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setClockInSaving(false);
    }
  }

  async function submitSchedule(e: FormEvent) {
    e.preventDefault();
    if (!formGuardId || !formSiteId || !formAt) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const created = await scheduleAlertness({
        guardId: formGuardId,
        siteId: formSiteId,
        scheduledAt: localInputToIso(formAt),
      });
      setScheduleOpen(false);
      setInfo(
        `Scheduled ${created.referenceNumber ?? 'check'} — guard must confirm on app.`,
      );
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onApproveAttendance(row: AttendanceRow) {
    setApprovingId(row.id);
    setError(null);
    setInfo(null);
    try {
      await approveAttendance(row.id);
      setInfo(`Approved attendance for ${guardLabel(row.guardId)}.`);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <BranchShell
      title="Attendance board"
      description="Today’s clock events (§9) with supervisor approve (guard ≠ approver) + supervisor manual clock-in (A2) + Guard Alertness (§10): schedule / mark / scan missed → FieldAlert."
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
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            Approval
            <select
              value={approvedFilter}
              onChange={(e) => setApprovedFilter(e.target.value)}
              className="rounded border border-[#e1dfdd] bg-white px-2 py-1 text-xs text-[#323130]"
            >
              <option value="">All</option>
              <option value="false">Pending</option>
              <option value="true">Approved</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setGeofenceFilter((v) => !v)}
            className={
              geofenceFilter
                ? `${btnPrimary} !bg-amber-600 !border-amber-600`
                : btnSecondary
            }
          >
            Geofence warnings
          </button>
          <button
            type="button"
            onClick={() => void onScanMissed()}
            disabled={scanning || loading}
            className={btnSecondary}
          >
            <AlarmClock
              className={`h-3.5 w-3.5 ${scanning ? 'animate-pulse' : ''}`}
            />
            {scanning ? 'Scanning…' : 'Scan missed'}
          </button>
          <button type="button" onClick={openSupervisorClockIn} className={btnPrimary}>
            <LogIn className="h-3.5 w-3.5" />
            Supervisor clock-in
          </button>
          <button type="button" onClick={openSchedule} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            Schedule check
          </button>
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
        Attendance (§9): supervisor Approve (SoD). Supervisor clock-in (A2).
        ABSENT / SUSPENDED / TERMINATED cannot start duty (8-G). Alertness
        (§10): auto-schedule; LATE confirm (10-A); miss remarks (10-B);
        today&apos;s history roster (10-C). Bio face/QR/selfie/payroll deferred.
      </p>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {info}
        </p>
      ) : null}

      <SectionTitle>Today — clock in / out</SectionTitle>
      <GlassCard className="mb-6 !p-0 overflow-hidden">
        {displayRows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <Clock3 className="h-5 w-5 text-[#a19f9d]" />
            <p>
              {geofenceFilter
                ? 'No geofence warnings for this filter'
                : 'No attendance clocked today for this filter'}
            </p>
          </div>
        ) : (
          <DataTable<AttendanceRow>
            loading={loading}
            keyField="id"
            rows={displayRows}
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
                key: 'clockInMethod',
                label: 'Method',
                render: (r) => (
                  <span className="font-mono text-[11px]">{r.clockInMethod}</span>
                ),
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
                key: 'isLate',
                label: 'Late',
                render: (r) =>
                  r.isLate ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                      {r.lateMinutes}m
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  ),
              },
              {
                key: 'isOvertime',
                label: 'OT',
                render: (r) =>
                  r.isOvertime ? (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-900">
                      {r.overtimeMinutes}m
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  ),
              },
              {
                key: 'geofenceWarning',
                label: 'Warning',
                render: (r) => {
                  if (r.geofenceWarning) {
                    return (
                      <span className="text-[11px] font-medium text-amber-700">
                        Geofence
                      </span>
                    );
                  }
                  if (hasNoGps(r)) {
                    return (
                      <span className="text-[11px] font-medium text-rose-700">
                        No GPS
                      </span>
                    );
                  }
                  return <span className="text-[11px] text-[#a19f9d]">—</span>;
                },
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
                    <button
                      type="button"
                      disabled={approvingId === r.id}
                      onClick={() => void onApproveAttendance(r)}
                      className={`${btnSecondary} !px-2 !py-0.5 text-[11px]`}
                    >
                      {approvingId === r.id ? '…' : 'Approve'}
                    </button>
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
            No scheduled alertness checks pending — use Schedule check
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
                label: 'Due',
                render: (r) => (
                  <span
                    className={
                      overduePending.has(r.id)
                        ? 'font-semibold text-rose-700'
                        : undefined
                    }
                  >
                    {formatDateTime(r.scheduledAt)}
                    {r.pastDue || overduePending.has(r.id)
                      ? ' · overdue → LATE if confirmed'
                      : ''}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'id',
                label: '',
                render: (r) => (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busyId === r.id}
                    onClick={() => void onMarkMissed(r.id)}
                  >
                    {busyId === r.id ? '…' : 'Mark missed'}
                  </button>
                ),
              },
            ]}
          />
        )}
      </GlassCard>

      <SectionTitle>Alertness history (today)</SectionTitle>
      <div className="mb-2 flex flex-wrap gap-2">
        {(
          [
            ['', 'Completed'],
            ['CONFIRMED', 'Confirmed'],
            ['LATE', 'Late'],
            ['MISSED', 'Missed'],
            ['CANCELLED', 'Cancelled'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id || 'all'}
            type="button"
            className={
              historyStatus === id
                ? btnPrimary
                : `${btnSecondary} !text-xs`
            }
            onClick={() => setHistoryStatus(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <GlassCard className="mb-6 !p-0 overflow-hidden">
        {history.length === 0 && !loading ? (
          <div className="px-4 py-8 text-center text-sm text-[#605e5c]">
            No completed alertness checks for today in this site filter.
          </div>
        ) : (
          <DataTable<AlertnessHistoryRow>
            loading={loading}
            keyField="id"
            rows={history}
            emptyMessage="No alertness history"
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
                key: 'employeeNumber',
                label: 'Guard',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {r.employeeNumber ?? guardLabel(r.guardId)}
                  </span>
                ),
              },
              {
                key: 'siteCode',
                label: 'Site',
                render: (r) => r.siteCode ?? siteLabel(r.siteId),
              },
              {
                key: 'scheduledAt',
                label: 'Due',
                render: (r) => formatDateTime(r.scheduledAt),
              },
              {
                key: 'confirmedAt',
                label: 'Confirmed',
                render: (r) =>
                  r.confirmedAt ? formatDateTime(r.confirmedAt) : '—',
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'method',
                label: 'Method',
                render: (r) => r.method ?? '—',
              },
              {
                key: 'supervisorRemarks',
                label: 'Remarks',
                render: (r) => (
                  <span className="line-clamp-2 max-w-[12rem] text-xs text-[#605e5c]">
                    {r.supervisorRemarks ?? '—'}
                  </span>
                ),
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
                key: 'escalationStage',
                label: 'Stage',
                render: (r) => (
                  <StatusBadge status={r.escalationStage ?? 'SUPERVISOR'} />
                ),
              },
              {
                key: 'createdAt',
                label: 'When',
                render: (r) => formatDateTime(r.createdAt),
              },
              {
                key: 'acknowledged',
                label: 'Actions',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.escalationStage !== 'CONTROL' ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={escalatingId === r.id}
                        onClick={() => void onEscalate(r.id)}
                      >
                        {escalatingId === r.id ? '…' : 'Escalate'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={ackingId === r.id}
                      onClick={() => void onAck(r.id)}
                    >
                      {ackingId === r.id ? '…' : 'Acknowledge'}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </GlassCard>

      {clockInOpen ? (
        <Modal
          title="Supervisor clock-in"
          description="Manual punch (SUPERVISOR method) when the guard mobile app fails. Uses site coordinates when GPS is omitted."
          onClose={() => setClockInOpen(false)}
        >
          <form
            onSubmit={(e) => void submitSupervisorClockIn(e)}
            className="space-y-3"
          >
            <div>
              <label className="text-sm font-medium text-[#323130]">Guard</label>
              <select
                className={inputCls}
                value={formClockInGuardId}
                onChange={(e) => setFormClockInGuardId(e.target.value)}
                required
              >
                <option value="">Select guard…</option>
                {guards
                  .filter(
                    (g) =>
                      !g.status ||
                      g.status === 'ACTIVE' ||
                      g.status === 'AVAILABLE',
                  )
                  .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.employeeNumber}
                    {g.fullName ? ` — ${g.fullName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">Site</label>
              <select
                className={inputCls}
                value={formClockInSiteId}
                onChange={(e) => setFormClockInSiteId(e.target.value)}
                required
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Remarks (optional)
              </label>
              <input
                className={inputCls}
                value={formClockInRemarks}
                onChange={(e) => setFormClockInRemarks(e.target.value)}
                placeholder="e.g. Mobile app offline — verified on post"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClockInOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={clockInSaving}
              >
                {clockInSaving ? 'Clocking in…' : 'Clock in'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {scheduleOpen ? (
        <Modal
          title="Schedule alertness check"
          description="Guard must confirm on the Guard app (GPS). Face / fingerprint / QR / selfie capture deferred."
          onClose={() => setScheduleOpen(false)}
        >
          <form onSubmit={(e) => void submitSchedule(e)} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[#323130]">Guard</label>
              <select
                className={inputCls}
                value={formGuardId}
                onChange={(e) => setFormGuardId(e.target.value)}
                required
              >
                <option value="">Select guard…</option>
                {guards
                  .filter(
                    (g) =>
                      g.status !== 'ABSENT' &&
                      g.status !== 'SUSPENDED' &&
                      g.status !== 'TERMINATED',
                  )
                  .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.employeeNumber}
                    {g.fullName ? ` — ${g.fullName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">Site</label>
              <select
                className={inputCls}
                value={formSiteId}
                onChange={(e) => setFormSiteId(e.target.value)}
                required
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#323130]">
                Due at
              </label>
              <input
                className={inputCls}
                type="datetime-local"
                value={formAt}
                onChange={(e) => setFormAt(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </BranchShell>
  );
}
