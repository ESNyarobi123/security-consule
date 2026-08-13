'use client';

import type { Invoice } from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import { Ban, CheckCircle2, FileText, Flag, Send, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

function formatMoney(amount: number, currency = 'TZS') {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: currency || 'TZS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'TZS'} ${amount.toLocaleString()}`;
  }
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
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

function invoiceStatusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'DRAFT')
    return {
      label: 'Draft',
      className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  if (s === 'SENT')
    return {
      label: 'Issued',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (s === 'PARTIALLY_PAID')
    return {
      label: 'Partially paid',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'OVERDUE')
    return {
      label: 'Overdue',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  if (s === 'DISPUTED')
    return {
      label: 'Disputed',
      className: 'bg-orange-50 text-orange-900 ring-orange-200/80',
      dot: 'bg-orange-500',
    };
  if (s === 'PAID')
    return {
      label: 'Fully paid',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'CLOSED')
    return {
      label: 'Closed',
      className: 'bg-slate-50 text-slate-600 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  if (s === 'VOIDED' || s === 'CANCELLED')
    return {
      label: 'Cancelled',
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
  const tone = invoiceStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function dueTone(dueDate: string, status: string): string {
  const s = status.trim().toUpperCase();
  if (s === 'PAID' || s === 'VOIDED' || s === 'CLOSED' || s === 'CANCELLED')
    return 'text-[#8a8886]';
  if (!dueDate) return 'text-[#605e5c]';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'text-[#605e5c]';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return 'text-rose-700 font-semibold';
  return 'text-[#605e5c]';
}

function PayProgress({ paid, total }: { paid: number; total: number }) {
  const pct =
    total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="mt-1.5 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-[#edebe9]">
      <div
        className={`h-full rounded-full transition-all ${
          pct >= 100
            ? 'bg-emerald-500'
            : pct > 0
              ? 'bg-[#0078d4]'
              : 'bg-transparent'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function InvoiceRoster({
  rows,
  loading,
  customerName,
  customerCode,
  busyId,
  onSend,
  onPay,
  onVoid,
  onDispute,
  onClose,
  toolbar,
  empty,
}: {
  rows: Invoice[];
  loading?: boolean;
  customerName: Map<string, string>;
  customerCode?: Map<string, string>;
  busyId?: string | null;
  onSend?: (inv: Invoice) => void;
  onPay?: (inv: Invoice) => void;
  onVoid?: (inv: Invoice) => void;
  onDispute?: (inv: Invoice) => void;
  onClose?: (inv: Invoice) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto_auto_auto_auto]';

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
        <span>Customer</span>
        <span>Invoice</span>
        <span>Total</span>
        <span>Paid</span>
        <span>Balance</span>
        <span>Due</span>
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
            const name =
              customerName.get(r.customerId) ??
              `Customer ${r.customerId.slice(0, 8)}`;
            const code = customerCode?.get(r.customerId);
            const bg = avatarColor(r.customerId);
            const bal = Math.max(r.totalAmount - r.amountPaid, 0);
            const s = r.status.trim().toUpperCase().replace(/[\s-]+/g, '_');
            const canSend = s === 'DRAFT';
            const canPay =
              s === 'SENT' ||
              s === 'PARTIALLY_PAID' ||
              s === 'OVERDUE' ||
              s === 'DISPUTED';
            const canDispute =
              s === 'SENT' || s === 'PARTIALLY_PAID' || s === 'OVERDUE';
            const canClose = s === 'PAID';
            const canVoid =
              (s === 'DRAFT' ||
                s === 'SENT' ||
                s === 'OVERDUE' ||
                s === 'DISPUTED') &&
              r.amountPaid <= 0;
            const paidPct =
              r.totalAmount > 0
                ? Math.min(
                    100,
                    Math.round((r.amountPaid / r.totalAmount) * 100),
                  )
                : 0;

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
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                              {r.invoiceNumber}
                              {code ? ` · ${code}` : ''}
                              {r.contractNumber
                                ? ` · ${r.contractNumber}`
                                : ''}
                            </p>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="mt-2 text-[15px] font-semibold tabular-nums text-[#1b1a19]">
                          {formatMoney(r.totalAmount, r.currency)}
                        </p>
                        <PayProgress paid={r.amountPaid} total={r.totalAmount} />
                        <p className="mt-1 text-[11px] text-[#8a8886]">
                          {paidPct}% paid · Bal {formatMoney(bal, r.currency)}
                        </p>
                        <p className={`mt-1 text-[12px] ${dueTone(r.dueDate, r.status)}`}>
                          Due {formatDate(r.dueDate)}
                        </p>
                      </div>
                    </div>
                    <InvoiceActions
                      canSend={canSend}
                      canPay={canPay}
                      canVoid={canVoid}
                      canDispute={canDispute}
                      canClose={canClose}
                      busy={busyId === r.id}
                      onSend={() => onSend?.(r)}
                      onPay={() => onPay?.(r)}
                      onVoid={() => onVoid?.(r)}
                      onDispute={() => onDispute?.(r)}
                      onClose={() => onClose?.(r)}
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
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                          {code ?? 'Customer'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="font-mono text-[12px] font-semibold text-[#323130]">
                        {r.invoiceNumber}
                      </p>
                      {r.contractNumber ? (
                        <p className="mt-0.5 font-mono text-[10px] text-[#8a8886]">
                          {r.contractNumber}
                        </p>
                      ) : null}
                      {r.serviceType ? (
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#605e5c]">
                          {r.serviceType.replace(/_/g, ' ')}
                        </p>
                      ) : null}
                      <div className="mt-1">
                        <StatusPill status={r.status} />
                      </div>
                    </div>

                    <div>
                      <span className="text-[13px] font-semibold tabular-nums text-[#1b1a19]">
                        {formatMoney(r.totalAmount, r.currency)}
                      </span>
                      <PayProgress paid={r.amountPaid} total={r.totalAmount} />
                      <p className="mt-0.5 text-[10px] tabular-nums text-[#a19f9d]">
                        {paidPct}% collected
                      </p>
                    </div>

                    <span className="text-[12px] font-semibold tabular-nums text-[#107c10]">
                      {formatMoney(r.amountPaid, r.currency)}
                    </span>

                    <span
                      className={`inline-flex w-fit rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums ${
                        bal > 0
                          ? 'bg-amber-50 text-amber-900'
                          : 'bg-[#f3f2f1] text-[#605e5c]'
                      }`}
                    >
                      {formatMoney(bal, r.currency)}
                    </span>

                    <span className={`text-[12px] tabular-nums ${dueTone(r.dueDate, r.status)}`}>
                      {formatDate(r.dueDate)}
                    </span>

                    <div className="flex flex-wrap justify-end gap-1">
                      <InvoiceActions
                        canSend={canSend}
                        canPay={canPay}
                        canVoid={canVoid}
                        canDispute={canDispute}
                        canClose={canClose}
                        busy={busyId === r.id}
                        onSend={() => onSend?.(r)}
                        onPay={() => onPay?.(r)}
                        onVoid={() => onVoid?.(r)}
                        onDispute={() => onDispute?.(r)}
                        onClose={() => onClose?.(r)}
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

function InvoiceActions({
  canSend,
  canPay,
  canVoid,
  canDispute,
  canClose,
  busy,
  onSend,
  onPay,
  onVoid,
  onDispute,
  onClose,
}: {
  canSend?: boolean;
  canPay?: boolean;
  canVoid?: boolean;
  canDispute?: boolean;
  canClose?: boolean;
  busy?: boolean;
  onSend: () => void;
  onPay: () => void;
  onVoid: () => void;
  onDispute: () => void;
  onClose: () => void;
}) {
  if (!canSend && !canPay && !canVoid && !canDispute && !canClose) {
    return <span className="text-[11px] text-[#c8c6c4]">—</span>;
  }
  return (
    <>
      {canSend ? (
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={onSend}
        >
          <Send className="h-3 w-3" />
          {busy ? 'Sending…' : 'Issue'}
        </button>
      ) : null}
      {canPay ? (
        <button type="button" className={btnSecondary} onClick={onPay}>
          <Wallet className="h-3 w-3" />
          Record payment
        </button>
      ) : null}
      {canDispute ? (
        <button type="button" className={btnSecondary} onClick={onDispute}>
          <Flag className="h-3 w-3" />
          Dispute
        </button>
      ) : null}
      {canClose ? (
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={onClose}
        >
          <CheckCircle2 className="h-3 w-3" />
          Close
        </button>
      ) : null}
      {canVoid ? (
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={onVoid}
        >
          <Ban className="h-3 w-3" />
          Cancel
        </button>
      ) : null}
    </>
  );
}

export function InvoicesEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <FileText className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
