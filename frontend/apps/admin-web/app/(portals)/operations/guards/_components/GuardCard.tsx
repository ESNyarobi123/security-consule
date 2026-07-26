'use client';

import type { Guard } from '@pssms/api-client';
import {
  BadgeCheck,
  MapPin,
  Phone,
  Rocket,
  ShieldOff,
  UserRound,
} from 'lucide-react';
import {
  WALL,
  guardDisplayName,
  guardInitials,
  statusTone,
} from './shared';

export function GuardCard({
  guard,
  busy,
  onOpen,
  onToggleSuspend,
  onToggleDeployable,
}: {
  guard: Guard;
  busy?: boolean;
  onOpen: (g: Guard) => void;
  onToggleSuspend: (g: Guard) => void;
  onToggleDeployable: (g: Guard) => void;
}) {
  const active = guard.status === 'ACTIVE';
  const ready = active && guard.deploymentEligible;
  const tone = statusTone(guard.status);
  const name = guardDisplayName(guard);
  const site =
    guard.activeDeployment?.siteCode ||
    guard.activeDeployment?.siteName ||
    null;

  return (
    <article
      className="guard-card group relative flex flex-col overflow-hidden rounded-xl transition duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: `linear-gradient(160deg, ${WALL.panel} 0%, #0d1f35 100%)`,
        border: `1px solid ${ready ? 'rgba(52, 211, 153, 0.35)' : WALL.borderStrong}`,
      }}
    >
      {ready ? (
        <span
          className="absolute right-3 top-3 flex h-2.5 w-2.5"
          title="Active · deployable"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onOpen(guard)}
        className="flex flex-1 flex-col px-4 pb-3 pt-4 text-left"
      >
        <div className="flex items-start gap-3">
          <Avatar guard={guard} ready={ready} />
          <div className="min-w-0 flex-1 pr-4">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: WALL.muted }}
            >
              {guard.employeeNumber}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
              >
                {tone.label}
              </span>
              {guard.deploymentEligible ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/25">
                  <BadgeCheck className="h-3 w-3" />
                  Deployable
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-slate-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-slate-400/20">
                  Not deployable
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 text-[12px]" style={{ color: WALL.muted }}>
          <p className="flex items-center gap-1.5 truncate">
            <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {guard.phone?.trim() || '—'}
          </p>
          {site ? (
            <p className="flex items-center gap-1.5 truncate text-emerald-200/90">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {site}
              {guard.activeDeployment?.status
                ? ` · ${guard.activeDeployment.status}`
                : ''}
            </p>
          ) : null}
        </div>
      </button>

      <div
        className="flex flex-wrap gap-1.5 px-3 py-2.5"
        style={{ borderTop: `1px solid ${WALL.border}` }}
      >
        <button
          type="button"
          disabled={busy || guard.status === 'TERMINATED'}
          onClick={() => onToggleSuspend(guard)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
          style={{
            background: active ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: active ? '#fda4af' : '#6ee7b7',
          }}
        >
          {active ? (
            <>
              <ShieldOff className="h-3.5 w-3.5" />
              Suspend
            </>
          ) : (
            <>
              <UserRound className="h-3.5 w-3.5" />
              Reactivate
            </>
          )}
        </button>
        <button
          type="button"
          disabled={busy || !active}
          onClick={() => onToggleDeployable(guard)}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-sky-400/15 px-2 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-400/25 disabled:opacity-50"
          title={
            active
              ? 'Toggle deployment eligibility'
              : 'Only active guards can be deployable'
          }
        >
          <Rocket className="h-3.5 w-3.5" />
          {guard.deploymentEligible ? 'Unset deploy' : 'Make deployable'}
        </button>
      </div>
    </article>
  );
}

function Avatar({ guard, ready }: { guard: Guard; ready: boolean }) {
  const initials = guardInitials(guard);
  if (guard.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote photo URLs from API
      <img
        src={guard.photoUrl}
        alt=""
        className={`h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ${
          ready ? 'ring-emerald-400/50' : 'ring-white/15'
        }`}
      />
    );
  }
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner ring-2 ring-white/10"
      style={{
        background: ready
          ? 'linear-gradient(145deg, #34d399 0%, #0e7490 55%, #0078d4 100%)'
          : 'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
      }}
    >
      {initials}
    </span>
  );
}
