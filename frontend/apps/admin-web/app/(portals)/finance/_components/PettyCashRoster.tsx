'use client';

import type { PettyCashVoucher } from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import { Paperclip, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

function formatMoney(amount: number) {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `TZS ${amount.toLocaleString()}`;
  }
}

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

function initials(seed: string): string {
  const parts = seed.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return 'PC';
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
  if (s === 'PENDING' || s === 'PENDING_APPROVAL')
    return {
      label: 'Pending',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED')
    return {
      label: 'Approved',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (s === 'REIMBURSED')
    return {
      label: 'Reimbursed',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'REJECTED' || s === 'CANCELLED')
    return {
      label: s === 'REJECTED' ? 'Rejected' : 'Cancelled',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
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

function CategoryPill({ category }: { category: string }) {
  return (
    <span className="inline-flex rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c] ring-1 ring-[#e1dfdd]">
      {category || '—'}
    </span>
  );
}

export function PettyCashRoster({
  rows,
  loading,
  busyId,
  canAct,
  onApprove,
  onReject,
  onReimburse,
  onReceipts,
  toolbar,
  empty,
}: {
  rows: PettyCashVoucher[];
  loading?: boolean;
  busyId?: string | null;
  /** false | 'own' | true for pending/approved actions */
  canAct?: (r: PettyCashVoucher) => boolean | 'own';
  onApprove?: (r: PettyCashVoucher) => void;
  onReject?: (r: PettyCashVoucher) => void;
  onReimburse?: (r: PettyCashVoucher) => void;
  onReceipts?: (r: PettyCashVoucher) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto_auto_auto]';

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
        <span>Voucher</span>
        <span>Amount</span>
        <span>Purpose</span>
        <span>Submitted</span>
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
            const act = canAct?.(r);
            const receiptHint = r.receiptUrl
              ? r.receiptUrl.startsWith('document:')
                ? 'MinIO receipt'
                : 'Receipt URL'
              : null;

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
                        {initials(r.voucherNumber)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-[13px] font-semibold text-[#1b1a19]">
                              {r.voucherNumber}
                            </p>
                            <div className="mt-1">
                              <CategoryPill category={r.category} />
                            </div>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="mt-2 text-[15px] font-semibold tabular-nums text-[#1b1a19]">
                          {formatMoney(r.amount)}
                        </p>
                        <p
                          className="mt-1 truncate text-[12px] text-[#605e5c]"
                          title={r.purpose}
                        >
                          {r.purpose}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8a8886]">
                          {formatDate(r.createdAt)}
                          {receiptHint ? ` · ${receiptHint}` : ''}
                        </p>
                      </div>
                    </div>
                    <PettyActions
                      status={s}
                      act={act}
                      busy={busyId === r.id}
                      onApprove={() => onApprove?.(r)}
                      onReject={() => onReject?.(r)}
                      onReimburse={() => onReimburse?.(r)}
                      onReceipts={() => onReceipts?.(r)}
                    />
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
                        {initials(r.voucherNumber)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] font-semibold text-[#1b1a19]">
                          {r.voucherNumber}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <CategoryPill category={r.category} />
                          {receiptHint ? (
                            <span className="text-[10px] font-medium text-[#0078d4]">
                              {receiptHint}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <span className="text-[13px] font-semibold tabular-nums text-[#1b1a19]">
                      {formatMoney(r.amount)}
                    </span>

                    <p
                      className="truncate text-[12px] text-[#605e5c]"
                      title={r.purpose}
                    >
                      {r.purpose || '—'}
                    </p>

                    <div>
                      <p className="text-[12px] tabular-nums text-[#605e5c]">
                        {formatDate(r.createdAt)}
                      </p>
                      {s === 'REIMBURSED' && r.reimbursedAt ? (
                        <p className="mt-0.5 text-[10px] text-[#8a8886]">
                          Paid {formatDateTime(r.reimbursedAt)}
                        </p>
                      ) : null}
                    </div>

                    <StatusPill status={r.status} />

                    <div className="flex flex-wrap justify-end gap-1">
                      <PettyActions
                        status={s}
                        act={act}
                        busy={busyId === r.id}
                        onApprove={() => onApprove?.(r)}
                        onReject={() => onReject?.(r)}
                        onReimburse={() => onReimburse?.(r)}
                        onReceipts={() => onReceipts?.(r)}
                      />
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

function PettyActions({
  status,
  act,
  busy,
  onApprove,
  onReject,
  onReimburse,
  onReceipts,
}: {
  status: string;
  act?: boolean | 'own';
  busy?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReimburse: () => void;
  onReceipts: () => void;
}) {
  if (status === 'PENDING') {
    if (act === 'own') {
      return (
        <span className="text-[11px] text-[#a19f9d]">
          Awaiting other approver
        </span>
      );
    }
    if (act === true) {
      return (
        <>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={onApprove}
          >
            Approve
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </button>
        </>
      );
    }
    return <span className="text-[11px] text-[#c8c6c4]">—</span>;
  }

  if (status === 'APPROVED') {
    return (
      <>
        <button type="button" className={btnSecondary} onClick={onReceipts}>
          <Paperclip className="h-3 w-3" />
          Receipts
        </button>
        {act === 'own' ? (
          <span className="text-[11px] text-[#a19f9d]">
            Creator cannot reimburse
          </span>
        ) : (
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || act === false}
            onClick={onReimburse}
          >
            Mark reimbursed
          </button>
        )}
      </>
    );
  }

  if (status === 'REIMBURSED') {
    return (
      <button type="button" className={btnSecondary} onClick={onReceipts}>
        <Paperclip className="h-3 w-3" />
        Receipts
      </button>
    );
  }

  return <span className="text-[11px] text-[#c8c6c4]">—</span>;
}

export function PettyCashEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <Wallet className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
