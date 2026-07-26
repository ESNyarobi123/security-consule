'use client';

import type { Guard } from '@pssms/api-client';
import {
  BadgeCheck,
  ExternalLink,
  MapPin,
  Rocket,
  ShieldOff,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import {
  WALL,
  formatWhen,
  guardDisplayName,
  guardInitials,
  statusTone,
} from './shared';

export function GuardDetailDrawer({
  guard,
  busy,
  onClose,
  onToggleSuspend,
  onToggleDeployable,
}: {
  guard: Guard;
  busy?: boolean;
  onClose: () => void;
  onToggleSuspend: (g: Guard) => void;
  onToggleDeployable: (g: Guard) => void;
}) {
  const active = guard.status === 'ACTIVE';
  const ready = active && guard.deploymentEligible;
  const tone = statusTone(guard.status);
  const name = guardDisplayName(guard);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[55] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} detail`}
    >
      <button
        type="button"
        aria-label="Close guard detail"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />
      <aside
        className="cctv-drawer relative z-10 flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{
          background: WALL.panel,
          borderLeft: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <header
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ring-2 ring-white/15"
              style={{
                background: ready
                  ? 'linear-gradient(145deg, #34d399 0%, #0e7490 55%, #0078d4 100%)'
                  : 'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
              }}
            >
              {guardInitials(guard)}
            </span>
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: WALL.muted }}
              >
                Guard profile
              </p>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-white">
                {name}
              </h2>
              <p className="font-mono text-xs" style={{ color: WALL.muted }}>
                {guard.employeeNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
            >
              {tone.label}
            </span>
            {guard.deploymentEligible ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/25">
                <BadgeCheck className="h-3.5 w-3.5" />
                Deployable
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-400/20">
                Not deployable
              </span>
            )}
            {ready ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/25">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Ready
              </span>
            ) : null}
          </div>

          <dl className="space-y-3 text-sm">
            <Row label="id">
              <span className="break-all font-mono text-[11px]" style={{ color: WALL.muted }}>
                {guard.id}
              </span>
            </Row>
            <Row label="employeeNumber">{guard.employeeNumber}</Row>
            {guard.fullName ? <Row label="fullName">{guard.fullName}</Row> : null}
            {guard.employeeId ? (
              <Row label="employeeId">
                <span className="break-all font-mono text-[11px]" style={{ color: WALL.muted }}>
                  {guard.employeeId}
                </span>
              </Row>
            ) : null}
            <Row label="userId">
              <span className="break-all font-mono text-[11px]" style={{ color: WALL.muted }}>
                {guard.userId}
              </span>
            </Row>
            <Row label="phone">{guard.phone?.trim() || '—'}</Row>
            <Row label="status">{guard.status}</Row>
            <Row label="deployable">
              {guard.deploymentEligible ? 'Yes' : 'No'}
            </Row>
            <Row label="createdAt">{formatWhen(guard.createdAt)}</Row>
            {guard.activeDeployment ? (
              <Row label="activeDeployment">
                <span className="inline-flex items-start gap-1.5 text-emerald-200">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {[
                      guard.activeDeployment.siteCode,
                      guard.activeDeployment.siteName,
                      guard.activeDeployment.status,
                    ]
                      .filter(Boolean)
                      .join(' · ') || guard.activeDeployment.id}
                    <span
                      className="mt-0.5 block font-mono text-[10px]"
                      style={{ color: WALL.muted }}
                    >
                      {guard.activeDeployment.id}
                    </span>
                  </span>
                </span>
              </Row>
            ) : null}
          </dl>

          <div
            className="mt-6 space-y-2 rounded-lg p-3"
            style={{
              background: 'rgba(15, 33, 55, 0.6)',
              border: `1px solid ${WALL.border}`,
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: WALL.muted }}
            >
              Ops links
            </p>
            <a
              href="/branch/deployments"
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-sky-200 transition hover:bg-white/5"
            >
              Branch deployments
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
            <a
              href="/operations"
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-sky-200 transition hover:bg-white/5"
            >
              Operations console
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </div>
        </div>

        <footer
          className="flex flex-wrap gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${WALL.border}` }}
        >
          <button
            type="button"
            disabled={busy || guard.status === 'TERMINATED'}
            onClick={() => onToggleSuspend(guard)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50"
            style={{
              background: active
                ? 'rgba(244, 63, 94, 0.18)'
                : 'rgba(16, 185, 129, 0.18)',
              color: active ? '#fda4af' : '#6ee7b7',
            }}
          >
            {active ? (
              <>
                <ShieldOff className="h-4 w-4" />
                Suspend
              </>
            ) : (
              <>
                <UserRound className="h-4 w-4" />
                Reactivate
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busy || !active}
            onClick={() => onToggleDeployable(guard)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-400/20 px-3 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/30 disabled:opacity-50"
          >
            <Rocket className="h-4 w-4" />
            {guard.deploymentEligible ? 'Unset deployable' : 'Make deployable'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b pb-2.5"
      style={{ borderColor: WALL.border }}
    >
      <dt
        className="shrink-0 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: WALL.muted }}
      >
        {label}
      </dt>
      <dd className="min-w-0 text-right text-slate-100">{children}</dd>
    </div>
  );
}
