'use client';

import {
  acknowledgeCctvEvent,
  createIncidentFromCctvEvent,
  type AnprResult,
  type DeviceEvent,
} from '@pssms/api-client';
import { StatusBadge } from '@pssms/ui';
import { AlertTriangle, Check, ScanLine, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  WALL,
  eventSeverity,
  eventTitle,
  relativeTime,
} from './shared';

const OPEN_STATUSES = ['RECEIVED', 'FAILED'];

const isAllow = (d?: string | null) =>
  d != null && ['ALLOW', 'ALLOWED'].includes(d.toUpperCase());
const isDeny = (d?: string | null) =>
  d != null && ['DENY', 'DENIED'].includes(d.toUpperCase());

export function SidePanels({
  alerts,
  anpr,
  eventsAvailable,
  onTriaged,
}: {
  alerts: DeviceEvent[];
  anpr: AnprResult[];
  /** false when GET /devices/events returned 404 / unavailable */
  eventsAvailable: boolean;
  /** Module 28-A — refresh after ack / incident recorded */
  onTriaged?: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ack(ev: DeviceEvent) {
    setBusyId(ev.id);
    setError(null);
    setNotice(null);
    try {
      await acknowledgeCctvEvent(ev.id);
      setNotice('Alert acknowledged (audited).');
      await onTriaged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function recordIncident(ev: DeviceEvent) {
    setBusyId(ev.id);
    setError(null);
    setNotice(null);
    try {
      const res = await createIncidentFromCctvEvent(ev.id);
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
        subtitle={
          eventsAvailable
            ? 'CCTV_EVENT from device ingest — ack or record incident'
            : 'Events API not available yet — inbox empty'
        }
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
            {eventsAvailable
              ? 'No open AI alerts.'
              : 'Connect cameras and wait for vision ingest (or seed CCTV_EVENT).'}
          </EmptyRow>
        ) : (
          <ul className="divide-y" style={{ borderColor: WALL.border }}>
            {alerts.slice(0, 12).map((ev) => {
              const sev = eventSeverity(ev.payload ?? {});
              const hot = ['HIGH', 'CRITICAL', 'ALARM'].includes(sev);
              const open = OPEN_STATUSES.includes(ev.status);
              const busy = busyId === ev.id;
              return (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 px-3 py-2.5 transition duration-200 hover:bg-white/[0.03]"
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: hot ? WALL.amber : WALL.accent,
                      boxShadow: hot
                        ? `0 0 8px ${WALL.amber}66`
                        : undefined,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {eventTitle(ev.payload ?? {})}
                      </p>
                      <span
                        className="shrink-0 font-mono text-[9px] uppercase"
                        style={{ color: hot ? WALL.amber : WALL.muted }}
                      >
                        {sev}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 font-mono text-[10px]"
                      style={{ color: WALL.muted }}
                    >
                      {ev.status}
                      {ev.routedTo ? ` · ${ev.routedTo}` : ''} ·{' '}
                      {relativeTime(ev.capturedAt)}
                    </p>
                    {open ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void ack(ev)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-200 ring-1 transition hover:bg-white/10 disabled:opacity-50"
                          style={{ borderColor: WALL.border }}
                        >
                          <Check className="h-3 w-3" />
                          Acknowledge
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void recordIncident(ev)}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 px-2 py-1 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-400/40 transition hover:bg-amber-400/30 disabled:opacity-50"
                        >
                          <ShieldAlert className="h-3 w-3" />
                          Record incident
                        </button>
                      </div>
                    ) : null}
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
                  <p
                    className="font-mono text-[10px]"
                    style={{ color: WALL.muted }}
                  >
                    {r.confidence != null
                      ? `${Math.round(r.confidence * 100)}% · `
                      : ''}
                    {relativeTime(r.capturedAt)}
                  </p>
                </div>
                {r.decision ? (
                  <span
                    className={
                      isDeny(r.decision)
                        ? 'opacity-100'
                        : isAllow(r.decision)
                          ? 'opacity-100'
                          : 'opacity-90'
                    }
                  >
                    <StatusBadge status={r.decision} />
                  </span>
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
      <div className="max-h-72 overflow-y-auto">{children}</div>
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
