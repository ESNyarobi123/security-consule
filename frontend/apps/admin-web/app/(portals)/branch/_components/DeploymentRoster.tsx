'use client';

import type { Deployment } from '@pssms/api-client';
import { btnSecondary } from '@pssms/ui';
import { MapPin, Shield } from 'lucide-react';
import type { ReactNode } from 'react';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return 'GD';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

const AVATAR = [
  '#0078d4',
  '#0d9488',
  '#7c3aed',
  '#ea580c',
  '#059669',
  '#0284c7',
  '#c026d3',
  '#b45309',
] as const;

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

function statusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'ACTIVE')
    return {
      label: 'Active',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'ENDED' || s === 'COMPLETED')
    return {
      label: 'Ended',
      className: 'bg-slate-50 text-slate-600 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  if (s === 'PENDING' || s === 'SCHEDULED')
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

export function DeploymentRoster({
  rows,
  loading,
  guardLabel,
  siteLabel,
  endingId,
  onEnd,
  toolbar,
  empty,
}: {
  rows: Deployment[];
  loading?: boolean;
  guardLabel: (guardId: string) => { primary: string; secondary?: string };
  siteLabel: (siteId: string) => { primary: string; secondary?: string };
  endingId?: string | null;
  onEnd?: (id: string) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto_auto_auto_auto]';
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      <div
        className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${grid}`}
      >
        <span>Guard</span>
        <span>Site</span>
        <span>Contract</span>
        <span>Start</span>
        <span>End</span>
        <span>Status</span>
        <span className="text-right"> </span>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="animate-pulse px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#edebe9]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-[#edebe9]" />
                  <div className="h-2.5 w-28 rounded bg-[#f3f2f1]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <ul className="divide-y divide-[#f3f2f1]">
          {rows.map((r) => {
            const guard = guardLabel(r.guardId);
            const site = siteLabel(r.siteId);
            const bg = avatarColor(r.guardId);
            const s = r.status.trim().toUpperCase();
            const canEnd = s === 'ACTIVE';
            const contractLabel = r.contractNumber?.trim() || null;

            return (
              <li key={r.id}>
                <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
                  {/* Mobile */}
                  <div className="space-y-2.5 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(guard.primary)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {guard.primary}
                            </p>
                            {guard.secondary ? (
                              <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                                {guard.secondary}
                              </p>
                            ) : null}
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#605e5c]">
                          <MapPin className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                          <span className="truncate">
                            {site.primary}
                            {site.secondary ? ` — ${site.secondary}` : ''}
                          </span>
                        </p>
                        {contractLabel ? (
                          <p className="mt-1 font-mono text-[11px] text-[#605e5c]">
                            {contractLabel}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-[#8a8886]">
                          {formatDate(r.startDate)} → {formatDate(r.endDate)}
                        </p>
                      </div>
                    </div>
                    {canEnd ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={endingId === r.id}
                        onClick={() => onEnd?.(r.id)}
                      >
                        {endingId === r.id ? 'Ending…' : 'End deployment'}
                      </button>
                    ) : null}
                  </div>

                  {/* Desktop */}
                  <div
                    className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(guard.primary)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {guard.primary}
                        </p>
                        {guard.secondary ? (
                          <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                            {guard.secondary}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-semibold text-[#323130]">
                        {site.primary}
                      </p>
                      {site.secondary ? (
                        <p className="mt-0.5 truncate text-[11px] text-[#8a8886]">
                          {site.secondary}
                        </p>
                      ) : null}
                    </div>

                    <span className="truncate font-mono text-[12px] text-[#605e5c]">
                      {contractLabel ?? '—'}
                    </span>

                    <span className="text-[12px] tabular-nums text-[#605e5c]">
                      {formatDate(r.startDate)}
                    </span>

                    <span className="text-[12px] tabular-nums text-[#605e5c]">
                      {formatDate(r.endDate)}
                    </span>

                    <StatusPill status={r.status} />

                    <div className="flex justify-end">
                      {canEnd ? (
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={endingId === r.id}
                          onClick={() => onEnd?.(r.id)}
                        >
                          {endingId === r.id ? 'Ending…' : 'End'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#c8c6c4]">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DeploymentsEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <Shield className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
