'use client';

import type { AuditLog } from '@pssms/api-client';
import { Modal } from '@pssms/ui';
import {
  IdCard,
  ListTree,
  ScrollText,
  UserRound,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

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
    a.includes('fail') ||
    a.includes('deny') ||
    a.includes('suspend')
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
    a.includes('confirm') ||
    a.includes('issue')
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
    a.includes('send') ||
    a.includes('record') ||
    a.includes('invite')
  )
    return {
      label: action,
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (
    a.includes('update') ||
    a.includes('status') ||
    a.includes('correct') ||
    a.includes('change') ||
    a.includes('close')
  )
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

function ActionPill({ action, label }: { action: string; label?: string }) {
  const tone = actionTone(action);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
      title={action}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="truncate">{label ?? tone.label}</span>
    </span>
  );
}

function ResourcePill({
  type,
  label,
}: {
  type: string;
  label?: string | null;
}) {
  return (
    <span
      title={type || undefined}
      className="inline-flex max-w-full truncate rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#605e5c] ring-1 ring-[#e1dfdd]"
    >
      {label || type || '—'}
    </span>
  );
}

function shortId(id?: string | null) {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function actorName(row: AuditLog) {
  return row.actorName || (row.actorId ? 'Unknown user' : 'System');
}

function pretty(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const asDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
  if (asDate) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return value;
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
        {label}
      </p>
      <div className="mt-0.5 break-words text-[13px] text-[#1b1a19]">
        {children}
      </div>
    </div>
  );
}

/** Full audit-entry drawer: who, what, when, and every changed field. */
export function AuditDetailsModal({
  row,
  onClose,
}: {
  row: AuditLog;
  onClose: () => void;
}) {
  const changes = row.changedFields ?? [];
  const tone = actionTone(row.action);
  return (
    <Modal
      title={row.actionLabel || row.action}
      description={row.summary ?? `${actorName(row)} · ${row.resourceType}`}
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {row.action}
          </span>
          <ResourcePill type={row.resourceType} label={row.resourceLabel} />
          <span className="font-mono text-[10px] text-[#8a8886]">
            {row.resourceType}
          </span>
        </div>

        <div className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-sm"
              style={{
                background: `linear-gradient(145deg, ${avatarColor(
                  actorName(row),
                )}, color-mix(in srgb, ${avatarColor(actorName(row))} 70%, #0f172a))`,
              }}
            >
              {initials(actorName(row))}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                {actorName(row)}
              </p>
              <p className="truncate text-[11px] text-[#605e5c]">
                {row.actorEmail ?? (row.actorId ? shortId(row.actorId) : 'No actor — system job')}
              </p>
              {row.actorRoles?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.actorRoles.map((r) => (
                    <span
                      key={r}
                      className="inline-flex rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0067b8] ring-1 ring-[#c7e0f4]"
                    >
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldRow label="When">{formatDateTime(row.createdAt)}</FieldRow>
          <FieldRow label="Resource">
            <span className="font-mono text-[12px]">
              {row.resourceLabel ?? row.resourceType}
            </span>
          </FieldRow>
          <FieldRow label="Resource ID">
            <span className="break-all font-mono text-[11px] text-[#605e5c]">
              {row.resourceId ?? '—'}
            </span>
          </FieldRow>
          <FieldRow label="IP address">
            <span className="font-mono text-[12px]">{row.ipAddress ?? '—'}</span>
          </FieldRow>
          <FieldRow label="Request ID">
            <span className="break-all font-mono text-[11px] text-[#605e5c]">
              {row.requestId ?? '—'}
            </span>
          </FieldRow>
          <FieldRow label="Event ID">
            <span className="break-all font-mono text-[11px] text-[#605e5c]">
              {row.id}
            </span>
          </FieldRow>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <ListTree className="h-4 w-4 text-[#0078d4]" />
            <h3 className="text-[13px] font-semibold text-[#1b1a19]">
              What changed
            </h3>
            <span className="rounded-full bg-[#eff6fc] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {changes.length}
            </span>
          </div>
          {changes.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-3 py-2.5 text-xs text-[#605e5c]">
              No field-level snapshot recorded for this action. The raw payload
              below shows everything the system stored.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#e1dfdd]">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#faf9f8] text-[10px] uppercase tracking-[0.1em] text-[#8a8886]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Field</th>
                    <th className="px-3 py-2 font-semibold">Before</th>
                    <th className="px-3 py-2 font-semibold">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {changes.map((c) => (
                    <tr key={c.field} className="align-top">
                      <td className="px-3 py-2 font-medium text-[#323130]">
                        {c.label}
                        <span className="mt-0.5 block font-mono text-[10px] text-[#a19f9d]">
                          {c.field}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-rose-800">
                        {pretty(c.from)}
                      </td>
                      <td className="px-3 py-2 text-emerald-800">
                        {pretty(c.to)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(row.before ?? row.after) ? (
          <details className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-semibold text-[#0067b8]">
              Raw payload (secrets redacted)
            </summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
                  Before
                </p>
                <pre className="max-h-56 overflow-auto rounded bg-white p-2 text-[10px] leading-relaxed text-[#323130] ring-1 ring-[#edebe9]">
                  {row.before ? JSON.stringify(row.before, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886]">
                  After
                </p>
                <pre className="max-h-56 overflow-auto rounded bg-white p-2 text-[10px] leading-relaxed text-[#323130] ring-1 ring-[#edebe9]">
                  {row.after ? JSON.stringify(row.after, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </details>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#e1dfdd] bg-white px-3 py-1.5 text-sm font-medium text-[#323130] hover:bg-[#f3f2f1]"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
            Close panel
          </button>
        </div>
      </div>
    </Modal>
  );
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
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const grid =
    'md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_auto_auto]';
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
        <span>What happened</span>
        <span>Resource</span>
        <span>Officer</span>
        <span>When</span>
        <span />
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
            const bg = avatarColor(actorName(r));
            const changeCount = r.changedFields?.length ?? 0;

            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setDetail(r)}
                  className="block w-full px-4 py-3.5 text-left transition hover:bg-[#f3f9fd]/60"
                >
                  {/* Mobile */}
                  <div className="space-y-2 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(actorName(r))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                          {r.actionLabel ?? r.action}
                        </p>
                        {r.summary ? (
                          <p
                            className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#605e5c]"
                            title={r.summary}
                          >
                            {r.summary}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <ResourcePill type={r.resourceType} label={r.resourceLabel} />
                          <span className="text-[11px] text-[#605e5c]">
                            {shortId(r.resourceId)}
                          </span>
                        </div>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#323130]">
                          <UserRound className="h-3 w-3 text-[#8a8886]" />
                          {actorName(r)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#605e5c]">
                          {formatDateTime(r.createdAt)}
                          {changeCount > 0 ? ` · ${changeCount} field${changeCount === 1 ? '' : 's'} changed` : ''}
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
                        {initials(actorName(r))}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                          {r.actionLabel ?? r.action}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <ActionPill action={r.action} label={r.action} />
                          {changeCount > 0 ? (
                            <span className="whitespace-nowrap text-[10px] text-[#8a8886]">
                              {changeCount} field{changeCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                        {r.summary ? (
                          <p
                            className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[#605e5c]"
                            title={r.summary}
                          >
                            {r.summary}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <ResourcePill type={r.resourceType} label={r.resourceLabel} />
                      <p
                        className="mt-0.5 truncate font-mono text-[10px] text-[#8a8886]"
                        title={r.resourceId ?? undefined}
                      >
                        {shortId(r.resourceId)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-[#323130]">
                        {actorName(r)}
                      </p>
                      <p className="truncate text-[10px] text-[#8a8886]">
                        {r.actorEmail ?? shortId(r.actorId)}
                      </p>
                    </div>

                    <span className="whitespace-nowrap text-[12px] tabular-nums text-[#605e5c]">
                      {formatDateTime(r.createdAt)}
                    </span>

                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#e1dfdd] bg-white px-2 py-1 text-[11px] font-semibold text-[#0067b8]">
                      <IdCard className="h-3 w-3" />
                      Details
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <AuditDetailsModal row={detail} onClose={() => setDetail(null)} />
      ) : null}
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
