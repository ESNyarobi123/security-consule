'use client';

import {
  acknowledgeCctvEvent,
  createIncidentFromCctvEvent,
  listCctvAlerts,
  type CctvAlert,
  type CctvAlertInbox,
} from '@pssms/api-client';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  MapPin,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alertStatusLabel,
  formatAge,
  formatApiError,
  formatWhen,
  cameraLabel,
  safeHttpUrl,
  severityChipLight,
  severityDot,
} from '../_components/shared';

type StatusFilter = 'OPEN' | 'CLOSED' | 'ALL';

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export default function CctvAlertsPage() {
  const [inbox, setInbox] = useState<CctvAlertInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<CctvAlert | null>(null);
  const [handling, setHandling] = useState<{
    row: CctvAlert;
    mode: 'ack' | 'incident';
  } | null>(null);
  const [handlingNote, setHandlingNote] = useState('');

  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [severity, setSeverity] = useState<string>('ALL');
  const [siteId, setSiteId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const sitesRef = useRef(new Map<string, string>());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCctvAlerts({
        status,
        severity: severity === 'ALL' ? undefined : severity,
        siteId: siteId || undefined,
        q: debounced || undefined,
        take: 80,
      });
      setInbox(res);
      // Keep a site picker built from what we have actually seen.
      for (const row of res.rows) {
        if (row.siteId && row.siteCode) {
          sitesRef.current.set(row.siteId, `${row.siteCode} · ${row.siteName ?? ''}`);
        }
      }
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [status, severity, siteId, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = inbox?.rows ?? [];
  const counts = inbox?.counts;

  const siteOptions = useMemo(() => {
    const map = new Map(sitesRef.current);
    for (const row of rows) {
      if (row.siteId && row.siteCode) {
        map.set(row.siteId, `${row.siteCode} · ${row.siteName ?? ''}`);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  async function ack(row: CctvAlert, note?: string) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      await acknowledgeCctvEvent(row.id, note?.trim() ? { note: note.trim() } : {});
      setNotice(
        `Acknowledged: ${row.detectionLabel} on ${cameraLabel(row.camera)}${
          note?.trim() ? ' — review note saved.' : '.'
        }`,
      );
      setHandling(null);
      setHandlingNote('');
      await load();
      setView(null);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function recordIncident(row: CctvAlert, note?: string) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const res = await createIncidentFromCctvEvent(
        row.id,
        note?.trim() ? { description: note.trim() } : {},
      );
      setNotice(
        `Incident ${res.incident.incidentNumber} recorded from this alert — triage it on Branch Ops › Incidents.`,
      );
      setHandling(null);
      setHandlingNote('');
      await load();
      setView(null);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1b1a19]">
            AI alert inbox
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-[#605e5c]">
            Every row is one camera event enriched with detection type, camera,
            zone, site, confidence, snapshot and the incident it produced. Video
            stays on the NVR — acknowledge to mark it reviewed, or record an
            incident to send it to Branch Ops.
          </p>
        </div>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Open alerts"
          value={counts?.open ?? '—'}
          tone="sky"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <Kpi
          label="Critical"
          value={counts?.critical ?? '—'}
          tone="rose"
          icon={<Siren className="h-4 w-4" />}
        />
        <Kpi
          label="High"
          value={counts?.high ?? '—'}
          tone="amber"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <Kpi
          label="Acknowledged 24h"
          value={counts?.acknowledged24h ?? '—'}
          tone="emerald"
          icon={<Check className="h-4 w-4" />}
        />
        <Kpi
          label="Incidents recorded"
          value={counts?.incidentsRecorded ?? '—'}
          tone="slate"
          icon={<ScanLine className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-2.5">
        <label className="min-w-[13rem] flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
            Search
          </span>
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8886]" />
            <input
              className={`${inputCls} mt-0 pl-8`}
              placeholder="Detection, camera, site, plate…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </label>
        <label className="w-[9.5rem]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
            Status
          </span>
          <select
            className={`${inputCls} mt-0`}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="OPEN">Open only</option>
            <option value="CLOSED">Reviewed</option>
            <option value="ALL">All</option>
          </select>
        </label>
        <label className="w-[9rem]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
            Severity
          </span>
          <select
            className={`${inputCls} mt-0`}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All severities' : s}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[11rem] flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
            Site
          </span>
          <select
            className={`${inputCls} mt-0`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">All my sites</option>
            {siteOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(siteId || severity !== 'ALL' || query) ? (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setSiteId('');
              setSeverity('ALL');
              setQuery('');
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[#e1dfdd] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#edebe9] text-left text-sm">
            <thead className="bg-[#faf9f8] text-[10px] uppercase tracking-[0.1em] text-[#8a8886]">
              <tr>
                <th className="px-3 py-2 font-semibold">Severity</th>
                <th className="px-3 py-2 font-semibold">Detection</th>
                <th className="px-3 py-2 font-semibold">Camera / site</th>
                <th className="px-3 py-2 font-semibold">Confidence</th>
                <th className="px-3 py-2 font-semibold">Captured</th>
                <th className="px-3 py-2 font-semibold">State</th>
                <th className="px-3 py-2 font-semibold">Incident</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f2f1]">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-[#605e5c]">
                    Loading alerts…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-[#605e5c]">
                    No alerts match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const busy = busyId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer align-top transition hover:bg-[#f8fbff]"
                      onClick={() => setView(row)}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${severityChipLight(row.severity)}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: severityDot(row.severity) }}
                          />
                          {row.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[#1b1a19]">
                          {row.detectionLabel}
                        </p>
                        <p className="text-[11px] text-[#605e5c]">
                          {row.detectionCategory}
                        </p>
                        {row.detectionInferred && row.detectionCode ? (
                          <p className="mt-0.5 text-[10px] font-medium text-[#8a5300]">
                            vendor code: {row.detectionCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="flex items-center gap-1 text-[13px] font-medium text-[#1b1a19]">
                          <Camera className="h-3 w-3 text-[#0078d4]" />
                          {cameraLabel(row.camera)}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-[#605e5c]">
                          <MapPin className="h-3 w-3" />
                          {row.siteCode ?? '—'}
                          {row.zone ? ` · ${row.zone}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.confidencePct == null ? (
                          <span className="text-[11px] text-[#8a8886]">n/a</span>
                        ) : (
                          <div className="w-16">
                            <p className="text-[12px] font-semibold text-[#1b1a19]">
                              {row.confidencePct}%
                            </p>
                            <span className="mt-0.5 block h-1 overflow-hidden rounded bg-[#edebe9]">
                              <span
                                className="block h-full rounded bg-[#0078d4]"
                                style={{ width: `${row.confidencePct}%` }}
                              />
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[12px] text-[#1b1a19]">
                          {formatAge(row.ageMinutes)}
                        </p>
                        <p className="text-[11px] text-[#8a8886]">
                          {formatWhen(row.capturedAt)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p
                          className={`text-[12px] font-medium ${
                            row.open ? 'text-[#0078d4]' : 'text-[#605e5c]'
                          }`}
                        >
                          {alertStatusLabel(row.status)}
                        </p>
                        {row.review?.acknowledgedByName ? (
                          <p
                            className={`text-[11px] ${
                              row.open ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {row.open
                              ? `last review attempt by ${row.review.acknowledgedByName}`
                              : `reviewed by ${row.review.acknowledgedByName}`}
                            {row.review.acknowledgedAt
                              ? ` · ${formatWhen(row.review.acknowledgedAt)}`
                              : ''}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#8a8886]">
                            {row.routedTo ? `→ ${row.routedTo}` : 'not routed'}
                          </p>
                        )}
                        {row.review?.note ? (
                          <p className="mt-0.5 max-w-[16rem] text-[10px] italic text-[#605e5c]">
                            “{row.review.note}”
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.incident ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#fff4ce] px-1.5 py-0.5 text-[11px] font-semibold text-[#8a5300]">
                            <ShieldAlert className="h-3 w-3" />
                            {row.incident.incidentNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8a8886]">—</span>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => setView(row)}
                          >
                            View
                          </button>
                          {row.open ? (
                            <>
                              <button
                                type="button"
                                className={btnSecondary}
                                disabled={busy}
                                onClick={() => {
                                  setHandlingNote('');
                                  setHandling({ row, mode: 'ack' });
                                }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Ack
                              </button>
                              <button
                                type="button"
                                className={btnPrimary}
                                disabled={busy}
                                onClick={() => {
                                  setHandlingNote('');
                                  setHandling({ row, mode: 'incident' });
                                }}
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Incident
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[#605e5c]">
        {inbox?.notes?.[0] ??
          'Severity, confidence, zone and snapshot are normalised from the vendor payload; the raw payload is kept for audit.'}
      </p>

      {view ? (
        <AlertDetailModal
          row={view}
          busy={busyId === view.id}
          onClose={() => setView(null)}
          onAck={() => {
            setHandlingNote('');
            setHandling({ row: view, mode: 'ack' });
            setView(null);
          }}
          onIncident={() => {
            setHandlingNote('');
            setHandling({ row: view, mode: 'incident' });
            setView(null);
          }}
        />
      ) : null}

      {handling ? (
        <HandleAlertModal
          row={handling.row}
          mode={handling.mode}
          note={handlingNote}
          busy={busyId === handling.row.id}
          onNote={setHandlingNote}
          onClose={() => {
            setHandling(null);
            setHandlingNote('');
          }}
          onConfirm={() =>
            handling.mode === 'ack'
              ? void ack(handling.row, handlingNote)
              : void recordIncident(handling.row, handlingNote)
          }
        />
      ) : null}
    </div>
  );
}

function HandleAlertModal({
  row,
  mode,
  note,
  busy,
  onNote,
  onClose,
  onConfirm,
}: {
  row: CctvAlert;
  mode: 'ack' | 'incident';
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isAck = mode === 'ack';
  return (
    <Modal
      title={isAck ? 'Acknowledge alert' : 'Record incident from alert'}
      description={`${row.detectionLabel} · ${cameraLabel(row.camera)}${
        row.siteCode ? ` · ${row.siteCode}` : ''
      }`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-3">
        <p className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-[13px] text-[#323130]">
          {row.summary}
        </p>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
            {isAck
              ? 'Review note (optional — what you saw on the live view)'
              : 'Incident description (optional — defaults to the AI alert context)'}
          </span>
          <textarea
            className={`${inputCls} mt-1 min-h-[92px] resize-y`}
            value={note}
            maxLength={2000}
            placeholder={
              isAck
                ? 'e.g. Live view confirmed a delivery van at the gate — no action needed.'
                : 'e.g. Confirmed forced entry at the west door — guard dispatched.'
            }
            onChange={(e) => onNote(e.target.value)}
          />
        </label>
        <p className="text-[11px] text-[#605e5c]">
          {isAck
            ? 'Acknowledging marks the alert reviewed and records your name in the audit trail. It does not close the camera event history.'
            : 'This creates a CCTV_ALERT incident at the camera site and links it back to this alert for Branch Ops triage.'}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy
              ? 'Saving…'
              : isAck
                ? 'Acknowledge review'
                : 'Record incident'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Kpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: 'sky' | 'rose' | 'amber' | 'emerald' | 'slate';
  icon: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
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
    </div>
  );
}

function AlertDetailModal({
  row,
  busy,
  onClose,
  onAck,
  onIncident,
}: {
  row: CctvAlert;
  busy: boolean;
  onClose: () => void;
  onAck: () => void;
  onIncident: () => void;
}) {
  const snapshot = safeHttpUrl(row.snapshotUrl);
  const [snapshotOk, setSnapshotOk] = useState(true);

  return (
    <Modal
      title={row.title}
      description={`${row.detectionCategory} · ${row.severity} · ${formatAge(row.ageMinutes)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ring-1 ${severityChipLight(row.severity)}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: severityDot(row.severity) }}
            />
            {row.severity}
          </span>
          <span className="rounded-full bg-[#deecf9] px-2.5 py-0.5 text-[11px] font-semibold text-[#005a9e]">
            {row.detectionLabel}
          </span>
          <span className="rounded-full bg-[#f3f2f1] px-2.5 py-0.5 text-[11px] font-medium text-[#605e5c]">
            {row.detectionCategory}
          </span>
          {row.detectionInferred ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
              vendor code {row.detectionCode ?? 'unknown'} · mapped
            </span>
          ) : null}
          {row.detectionType === 'CAMERA_EVENT' ? (
            <span className="rounded-full bg-[#fff4ce] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a5300]">
              no AI classification from camera
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              row.open
                ? 'bg-[#fff4ce] text-[#8a5300]'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {alertStatusLabel(row.status)}
          </span>
          {row.incident ? (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
              Incident {row.incident.incidentNumber} · {row.incident.status}
            </span>
          ) : null}
        </div>

        <p className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-sm text-[#323130]">
          {row.summary}
        </p>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
            Recommended response
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-amber-900">
            {row.recommendedAction}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Camera">
            {row.camera ? (
              <span>
                {row.camera.name}{' '}
                <span className="text-[#605e5c]">({row.camera.code})</span>
                <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                  {[row.camera.vendor, row.camera.model]
                    .filter(Boolean)
                    .join(' · ') || 'vendor not recorded'}
                  {row.camera.nvrChannel
                    ? ` · NVR ch ${row.camera.nvrChannel}`
                    : ''}
                </span>
                <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                  Camera status {row.camera.status}
                  {row.camera.lastSeenAt
                    ? ` · last seen ${formatWhen(row.camera.lastSeenAt)}`
                    : ''}
                </span>
              </span>
            ) : (
              'No camera linked to this event'
            )}
          </Field>
          <Field label="Site / zone">
            <span>
              {row.siteCode ?? '—'}
              {row.siteName ? ` · ${row.siteName}` : ''}
              <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                Zone: {row.zone ?? 'not set'}
              </span>
            </span>
          </Field>
          <Field label="Confidence">
            {row.confidencePct == null ? (
              'not reported by the camera'
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-semibold">{row.confidencePct}%</span>
                <span className="h-1.5 w-24 overflow-hidden rounded bg-[#edebe9]">
                  <span
                    className="block h-full rounded bg-[#0078d4]"
                    style={{ width: `${row.confidencePct}%` }}
                  />
                </span>
              </span>
            )}
          </Field>
          <Field label="Captured">
            <span>
              {formatWhen(row.capturedAt)}
              <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                Received {formatWhen(row.receivedAt)}
                {row.review?.acknowledgedAt
                  ? ` · reviewed ${formatWhen(row.review.acknowledgedAt)}`
                  : row.processedAt
                    ? ` · processed ${formatWhen(row.processedAt)}`
                    : ''}
              </span>
            </span>
          </Field>
          <Field
            label={
              row.open && row.review?.acknowledgedByName
                ? 'Review trail'
                : 'Reviewed by'
            }
          >
            {row.review?.acknowledgedByName ? (
              <span>
                {row.review.acknowledgedByName}
                {row.review.acknowledgedAt ? (
                  <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                    {formatWhen(row.review.acknowledgedAt)}
                  </span>
                ) : null}
                {row.review.note ? (
                  <span className="mt-0.5 block text-[11px] italic text-[#605e5c]">
                    “{row.review.note}”
                  </span>
                ) : null}
                {row.open ? (
                  <span className="mt-0.5 block text-[11px] text-amber-700">
                    Alert is open again (the camera event was re-ingested); the
                    audit trail is kept.
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-[#8a8886]">
                Awaiting review — acknowledge once the live view is checked
              </span>
            )}
          </Field>
          <Field label="Incident recorded by">
            {row.review?.incidentByName ? (
              <span>
                {row.review.incidentByName}
                {row.review.incidentAt ? (
                  <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                    {formatWhen(row.review.incidentAt)}
                  </span>
                ) : null}
                {row.incident ? (
                  <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                    {row.incident.incidentNumber} · {row.incident.status}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-[#8a8886]">No incident recorded</span>
            )}
          </Field>
          <Field label="Plate / object">
            {row.plateNumber || row.objectClass ? (
              <span>
                {row.plateNumber ? (
                  <span className="mr-2 font-mono font-semibold tracking-wide">
                    {row.plateNumber}
                  </span>
                ) : null}
                {row.objectClass ? (
                  <span className="text-[12px] text-[#605e5c]">
                    {row.objectClass}
                  </span>
                ) : null}
                {row.personCount != null ? (                  <span className="mt-0.5 block text-[11px] text-[#605e5c]">
                    {row.personCount} person(s) detected
                  </span>
                ) : null}
              </span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Bounding box">
            {row.boundingBox
              ? row.boundingBox.join(', ')
              : 'not reported (normalised x, y, w, h)'}
          </Field>
          <Field label="Routing">
            <span>
              {row.routedTo ?? 'not routed'}
              {row.error ? (
                <span className="mt-0.5 block text-[11px] text-rose-700">
                  {row.error}
                </span>
              ) : null}
            </span>
          </Field>
          <Field label="Event id">
            <span className="break-all font-mono text-[11px]">{row.id}</span>
          </Field>
        </div>

        {snapshot && snapshotOk ? (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
              Snapshot (reference only — stream stays on the NVR)
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshot}
              alt={`Snapshot from ${cameraLabel(row.camera)}`}
              className="max-h-72 w-full rounded-md border border-[#e1dfdd] object-contain"
              onError={() => setSnapshotOk(false)}
            />
          </div>
        ) : (
          <p className="flex items-center gap-1.5 rounded-md border border-dashed border-[#e1dfdd] px-3 py-2 text-[12px] text-[#605e5c]">
            <Clock className="h-3.5 w-3.5" />
            No snapshot reference on this event
            {snapshot && !snapshotOk ? ' (image failed to load)' : ''}.
          </p>
        )}

        <details className="rounded-md border border-[#e1dfdd]">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-[#323130]">
            Raw vendor payload
          </summary>
          <pre className="max-h-56 overflow-auto border-t border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] leading-relaxed text-[#323130]">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </details>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#edebe9] pt-3">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
          {row.open ? (
            <>
              <button
                type="button"
                className={btnSecondary}
                disabled={busy}
                onClick={onAck}
              >
                <Check className="h-3.5 w-3.5" />
                Acknowledge
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={busy}
                onClick={onIncident}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Record incident
              </button>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#edebe9] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
        {label}
      </p>
      <div className="mt-0.5 break-words text-[13px] text-[#1b1a19]">
        {children}
      </div>
    </div>
  );
}
