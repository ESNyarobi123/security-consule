'use client';

import type { AnprResult, DeviceEvent } from '@pssms/api-client';
import { StatusBadge } from '@pssms/ui';
import { AlertTriangle, ScanLine } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  WALL,
  eventSeverity,
  eventTitle,
  relativeTime,
} from './shared';

const isAllow = (d?: string | null) =>
  d != null && ['ALLOW', 'ALLOWED'].includes(d.toUpperCase());
const isDeny = (d?: string | null) =>
  d != null && ['DENY', 'DENIED'].includes(d.toUpperCase());

export function SidePanels({
  alerts,
  anpr,
  eventsAvailable,
}: {
  alerts: DeviceEvent[];
  anpr: AnprResult[];
  /** false when GET /devices/events returned 404 / unavailable */
  eventsAvailable: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        icon={<AlertTriangle className="h-4 w-4" style={{ color: WALL.amber }} />}
        title="AI alert inbox"
        subtitle={
          eventsAvailable
            ? 'CCTV_EVENT from device ingest'
            : 'Events API not available yet — inbox empty'
        }
      >
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
                      {ev.status} · {relativeTime(ev.capturedAt)}
                    </p>
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
