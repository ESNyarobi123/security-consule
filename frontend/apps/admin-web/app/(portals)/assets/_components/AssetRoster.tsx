'use client';

import type { Asset, PendingReturnAssignment } from '@pssms/api-client';
import { btnPrimary } from '@pssms/ui';
import { Package, PackageCheck, UserPlus } from 'lucide-react';
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
  if (parts.length === 0) return 'AS';
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
  if (s === 'AVAILABLE')
    return {
      label: 'Available',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'ASSIGNED')
    return {
      label: 'Assigned',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (s === 'RETURN_PENDING')
    return {
      label: 'Return pending',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'MAINTENANCE')
    return {
      label: 'Maintenance',
      className: 'bg-violet-50 text-violet-800 ring-violet-200/80',
      dot: 'bg-violet-500',
    };
  if (s === 'DISPOSED')
    return {
      label: 'Disposed',
      className: 'bg-slate-50 text-slate-600 ring-slate-200/80',
      dot: 'bg-slate-400',
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

function CategoryPill({ category }: { category?: string | null }) {
  if (!category) return <span className="text-[11px] text-[#a19f9d]">—</span>;
  return (
    <span className="inline-flex rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c] ring-1 ring-[#e1dfdd]">
      {category}
    </span>
  );
}

export function AssetRoster({
  rows,
  loading,
  assigneeLabel,
  onAssign,
  toolbar,
  empty,
}: {
  rows: Asset[];
  loading?: boolean;
  assigneeLabel: (r: Asset) => string | null;
  onAssign?: (r: Asset) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.2fr)_auto_auto_auto]';
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
        <span>Asset</span>
        <span>Category</span>
        <span>Assignee</span>
        <span>Registered</span>
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
            const bg = avatarColor(r.id);
            const s = r.status.trim().toUpperCase();
            const canAssign = s === 'AVAILABLE';
            const who = assigneeLabel(r);

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
                        {initials(r.assetTag || r.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {r.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                              {r.assetTag}
                            </p>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="mt-2">
                          <CategoryPill category={r.category} />
                        </div>
                        <p className="mt-1.5 truncate text-[12px] text-[#605e5c]">
                          {who ?? 'Unassigned'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8a8886]">
                          {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    {canAssign ? (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => onAssign?.(r)}
                      >
                        <UserPlus className="h-3 w-3" />
                        Assign
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#a19f9d]">
                        {s === 'ASSIGNED' || s === 'RETURN_PENDING'
                          ? 'Issued'
                          : s.replace(/_/g, ' ')}
                      </span>
                    )}
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
                        {initials(r.assetTag || r.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {r.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                          {r.assetTag}
                          {r.serialNumber ? ` · ${r.serialNumber}` : ''}
                        </p>
                      </div>
                    </div>

                    <CategoryPill category={r.category} />

                    <p
                      className="truncate text-[12px] text-[#605e5c]"
                      title={who ?? undefined}
                    >
                      {who ?? (
                        <span className="text-[#a19f9d]">Unassigned</span>
                      )}
                    </p>

                    <span className="text-[12px] tabular-nums text-[#605e5c]">
                      {formatDate(r.createdAt)}
                    </span>

                    <StatusPill status={r.status} />

                    <div className="flex justify-end">
                      {canAssign ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => onAssign?.(r)}
                        >
                          <UserPlus className="h-3 w-3" />
                          Assign
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#c8c6c4]">
                          {s === 'ASSIGNED' || s === 'RETURN_PENDING'
                            ? 'Issued'
                            : '—'}
                        </span>
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

export function AssetsEmpty({
  title,
  description,
  icon = 'package',
}: {
  title: string;
  description: string;
  icon?: 'package' | 'returns';
}) {
  const Icon = icon === 'returns' ? PackageCheck : Package;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReturnsRoster({
  rows,
  loading,
  holderLabel,
  canConfirm,
  onConfirm,
  toolbar,
  empty,
}: {
  rows: PendingReturnAssignment[];
  loading?: boolean;
  holderLabel: (r: PendingReturnAssignment) => string | null;
  canConfirm?: (r: PendingReturnAssignment) => boolean | 'own';
  onConfirm?: (r: PendingReturnAssignment) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto]';
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
        <span>Asset</span>
        <span>Holder</span>
        <span>Requested</span>
        <span>Notes</span>
        <span>Status</span>
        <span className="text-right"> </span>
      </div>

      {loading && rows.length === 0 ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: 4 }).map((_, i) => (
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
            const tag = r.assetTag ?? r.assetId.slice(0, 8);
            const name = r.assetName ?? 'Equipment';
            const bg = avatarColor(r.assetId);
            const act = canConfirm?.(r);
            const holder = holderLabel(r);

            return (
              <li key={r.id}>
                <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
                  <div className="space-y-2.5 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(tag)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                              {tag}
                            </p>
                          </div>
                          <StatusPill
                            status={r.assetStatus ?? 'RETURN_PENDING'}
                          />
                        </div>
                        <p className="mt-2 text-[12px] text-[#605e5c]">
                          {holder ?? 'Unknown holder'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#8a8886]">
                          {formatDateTime(r.returnRequestedAt)}
                        </p>
                        {r.notes ? (
                          <p
                            className="mt-1 truncate text-[12px] text-[#605e5c]"
                            title={r.notes}
                          >
                            {r.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {act === 'own' ? (
                      <span className="text-[11px] text-[#a19f9d]">
                        Awaiting other confirmer
                      </span>
                    ) : act === true ? (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => onConfirm?.(r)}
                      >
                        Confirm return
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#c8c6c4]">—</span>
                    )}
                  </div>

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
                        {initials(tag)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] text-[#8a8886]">
                            {tag}
                          </span>
                          <CategoryPill category={r.assetCategory} />
                        </div>
                      </div>
                    </div>

                    <p className="truncate text-[12px] text-[#605e5c]">
                      {holder ?? (
                        <span className="text-[#a19f9d]">Unknown</span>
                      )}
                    </p>

                    <span className="text-[12px] tabular-nums text-[#605e5c]">
                      {formatDateTime(r.returnRequestedAt)}
                    </span>

                    <p
                      className="truncate text-[12px] text-[#605e5c]"
                      title={r.notes ?? undefined}
                    >
                      {r.notes || '—'}
                    </p>

                    <StatusPill status={r.assetStatus ?? 'RETURN_PENDING'} />

                    <div className="flex justify-end">
                      {act === 'own' ? (
                        <span className="text-[11px] text-[#a19f9d]">
                          Awaiting other confirmer
                        </span>
                      ) : act === true ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => onConfirm?.(r)}
                        >
                          Confirm
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
