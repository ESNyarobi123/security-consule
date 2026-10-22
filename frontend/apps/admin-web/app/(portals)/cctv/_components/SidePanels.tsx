'use client';

import {
  acknowledgeCctvEvent,
  createIncidentFromCctvEvent,
  type CctvAlert,
  type CctvOverview,
} from '@pssms/api-client';
import { StatusBadge } from '@pssms/ui';
import {
  AlertTriangle,
  Check,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  WALL,
  alertStatusLabel,
  cameraLabel,
  formatAge,
  severityDot,
} from './shared';

export function SidePanels({
  overview,
  onTriaged,
}: {
  overview: CctvOverview | null;
  /** Module 28-A — refresh after ack / incident recorded */
  onTriaged?: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alerts = overview?.aiAlerts.latest ?? [];
  const anpr = overview?.parking.latestAnpr ?? [];

  async function ack(alert: CctvAlert) {
    setBusyId(alert.id);
    setError(null);
    setNotice(null);
    try {
      await acknowledgeCctvEvent(alert.id);
      setNotice(
        `Acknowledged ${alert.detectionLabel} on ${cameraLabel(alert.camera)}.`,
      );
      await onTriaged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function recordIncident(alert: CctvAlert) {
    setBusyId(alert.id);
    setError(null);
    setNotice(null);
    try {
      const res = await createIncidentFromCctvEvent(alert.id);
      setNotice(
        `Incident ${res.incident.incidentNumber} recorded — track it on Branch Ops › Incidents.`,
      );
      await onTriaged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        icon={<AlertTriangle className="h-4 w-4" style={{ color: WALL.amber }} />}
        title="AI alert inbox"
        subtitle="Detection · camera · site · confidence · age"
      >
        {notice ? (
          <p
            className="border-b px-3 py-2 text-[11px] text-emerald-300"
            style={{ borderColor: WALL.border }}
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            className="border-b px-3 py-2 text-[11px] text-rose-300"
            style={{ borderColor: WALL.border }}
          >
            {error}
          </p>
        ) : null}
        {alerts.length === 0 ? (
          <EmptyRow>
            No open AI alerts. Connect cameras and wait for vision ingest (or
            seed CCTV_EVENT).
          </EmptyRow>
        ) : (
          <ul className="divide-y" style={{ borderColor: WALL.border }}>
            {alerts.slice(0, 10).map((alert) => {
              const busy = busyId === alert.id;
              const hot = ['HIGH', 'CRITICAL', 'ALARM'].includes(alert.severity);
              return (
                <li
                  key={alert.id}
                  className="px-3 py-2.5 transition duration-200 hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: severityDot(alert.severity),
                        boxShadow: hot
                          ? `0 0 8px ${severityDot(alert.severity)}88`
                          : undefined,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {alert.detectionLabel}
                        </p>
                        <span
                          className="shrink-0 font-mono text-[9px] uppercase tracking-wide"
                          style={{ color: hot ? WALL.amber : WALL.muted }}
                        >
                          {alert.severity}
                          {alert.confidencePct != null
                            ? ` · ${alert.confidencePct}%`
                            : ''}
                        </span>
                      </div>
                      <p
                        className="mt-0.5 truncate font-mono text-[10px]"
                        style={{ color: WALL.muted }}
                      >
                        {cameraLabel(alert.camera)} · {alert.siteCode ?? '—'}
                        {alert.zone ? ` · ${alert.zone}` : ''}
                      </p>
                      <p
                        className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                        style={{ color: '#cbd5e1' }}
                      >
                        {alert.summary}
                      </p>
                      <p
                        className="mt-1 font-mono text-[9px]"
                        style={{ color: WALL.muted }}
                      >
                        {alertStatusLabel(alert.status)} ·{' '}
                        {formatAge(alert.ageMinutes)}
                        {alert.incident
                          ? ` · ${alert.incident.incidentNumber}`
                          : ''}
                      </p>
                      {alert.open ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void ack(alert)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-200 ring-1 transition hover:bg-white/10 disabled:opacity-50"
                            style={{ borderColor: WALL.border }}
                          >
                            <Check className="h-3 w-3" />
                            Acknowledge
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void recordIncident(alert)}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-1 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-400/40 transition hover:bg-amber-400/30 disabled:opacity-50"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Record incident
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        icon={<ScanLine className="h-4 w-4" style={{ color: WALL.accent }} />}
        title="ANPR recent"
        subtitle="Plate captures — decisions stay on parking / vision"
      >
        {anpr.length === 0 ? (
          <EmptyRow>No ANPR results yet.</EmptyRow>
        ) : (
          <ul className="divide-y" style={{ borderColor: WALL.border }}>
            {anpr.slice(0, 12).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 transition duration-200 hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold tracking-wide text-white">
                    {r.plateNumber}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
                    {r.siteCode ?? '—'} ·{' '}
                    {r.confidence != null
                      ? `${Math.round(r.confidence * 100)}% · `
                      : ''}
                    {formatAge(
                      Math.max(
                        0,
                        Math.round(
                          (Date.now() - new Date(r.capturedAt).getTime()) / 60000,
                        ),
                      ),
                    )}
                  </p>
                </div>
                {r.decision ? (
                  <StatusBadge status={r.decision} />
                ) : (
                  <span className="text-[10px]" style={{ color: WALL.muted }}>
                    —
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg transition duration-300"
      style={{
        background: WALL.bgSoft,
        border: `1px solid ${WALL.border}`,
      }}
    >
      <header
        className="flex items-start gap-2.5 px-3 py-3"
        style={{ borderBottom: `1px solid ${WALL.border}` }}
      >
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'rgba(0, 120, 212, 0.12)' }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-[11px]" style={{ color: WALL.muted }}>
            {subtitle}
          </p>
        </div>
      </header>
      <div className="max-h-80 overflow-y-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-8 text-center text-xs" style={{ color: WALL.muted }}>
      {children}
    </p>
  );
}
