'use client';

import type { AuditLog } from '@pssms/api-client';
import { ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDateTime } from './shared';

function initials(seed: string): string {
  const parts = seed.trim().split(/[.\s_-]+/).filter(Boolean);
  if (parts.length === 0) return 'AU';
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

function actionTone(action: string): {
  label: string;
  className: string;
  dot: string;
} {
  const a = action.trim().toLowerCase();
  if (
    a.includes('reject') ||
    a.includes('delete') ||
    a.includes('void') ||
    a.includes('breach') ||
    a.includes('fail')
  )
    return {
      label: action,
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  if (
    a.includes('approve') ||
    a.includes('publish') ||
    a.includes('paid') ||
    a.includes('reimburse') ||
    a.includes('confirm')
  )
    return {
      label: action,
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (
    a.includes('create') ||
    a.includes('submit') ||
    a.includes('assign') ||
    a.includes('send')
  )
    return {
      label: action,
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (a.includes('update') || a.includes('status') || a.includes('correct'))
    return {
      label: action,
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  return {
    label: action,
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function ActionPill({ action }: { action: string }) {
  const tone = actionTone(action);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
      title={action}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="truncate">{tone.label}</span>
    </span>
  );
}

function ResourcePill({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c] ring-1 ring-[#e1dfdd]">
      {type || '—'}
    </span>
  );
}

function shortId(id?: string | null) {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function AuditLogRoster({
  rows,
  loading,
  toolbar,
  empty,
}: {
  rows: AuditLog[];
  loading?: boolean;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]';
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
        <span>Action</span>
        <span>Resource</span>
        <span>Resource ID</span>
        <span>Actor</span>
        <span>When</span>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="animate-pulse px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#edebe9]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 rounded bg-[#edebe9]" />
                  <div className="h-2.5 w-32 rounded bg-[#f3f2f1]" />
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
            const seed = r.action || r.resourceType || r.id;
            const bg = avatarColor(seed);

            return (
              <li key={r.id}>
                <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
                  {/* Mobile */}
                  <div className="space-y-2 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(r.resourceType || r.action)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ActionPill action={r.action} />
                        <div className="mt-1.5">
                          <ResourcePill type={r.resourceType} />
                        </div>
                        <p className="mt-2 font-mono text-[11px] text-[#8a8886]">
                          {shortId(r.resourceId)} · actor {shortId(r.actorId)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#605e5c]">
                          {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div
                    className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(r.resourceType || r.action)}
                      </span>
                      <ActionPill action={r.action} />
                    </div>

                    <ResourcePill type={r.resourceType} />

                    <span
                      className="truncate font-mono text-[11px] text-[#605e5c]"
                      title={r.resourceId ?? undefined}
                    >
                      {shortId(r.resourceId)}
                    </span>

                    <span
                      className="truncate font-mono text-[11px] text-[#605e5c]"
                      title={r.actorId ?? undefined}
                    >
                      {shortId(r.actorId)}
                    </span>

                    <span className="text-[12px] tabular-nums text-[#605e5c]">
                      {formatDateTime(r.createdAt)}
                    </span>
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

export function AuditEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <ScrollText className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
