'use client';

import type { PurchaseOrder, Supplier, SupplierSubmission } from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import { ClipboardList, Mail, Phone, Truck } from 'lucide-react';
import type { ReactNode } from 'react';

function formatMoney(amount: number, currency = 'TZS') {
  try {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: currency || 'TZS',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency || 'TZS'} ${amount.toLocaleString()}`;
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

function supplierStatusTone(status: string) {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'PENDING' || s === 'PENDING_APPROVAL' || s === 'DRAFT')
    return {
      label: s === 'DRAFT' ? 'Draft' : 'Pending',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED' || s === 'ACTIVE')
    return {
      label: 'Approved',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'REJECTED' || s === 'SUSPENDED' || s === 'INACTIVE')
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function poStatusTone(status: string) {
  const s = status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'DRAFT')
    return {
      label: 'Draft',
      className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  if (s === 'PENDING_APPROVAL' || s === 'SUBMITTED')
    return {
      label: 'Pending approval',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED')
    return {
      label: 'Approved',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  if (s === 'REJECTED' || s === 'CANCELLED')
    return {
      label: s === 'REJECTED' ? 'Rejected' : 'Cancelled',
      className: 'bg-rose-50 text-rose-800 ring-rose-200/80',
      dot: 'bg-rose-500',
    };
  if (s === 'ORDERED' || s === 'RECEIVED' || s === 'CLOSED')
    return {
      label: status.replace(/_/g, ' '),
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function StatusPill({
  status,
  kind,
}: {
  status: string;
  kind: 'supplier' | 'po';
}) {
  const tone =
    kind === 'supplier' ? supplierStatusTone(status) : poStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function RosterShell({
  toolbar,
  header,
  loading,
  empty,
  children,
  rowsEmpty,
}: {
  toolbar?: ReactNode;
  header: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  children: ReactNode;
  rowsEmpty: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}
      {header}
      {loading && rowsEmpty ? (
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
      ) : rowsEmpty ? (
        <div className="p-4">{empty}</div>
      ) : (
        children
      )}
    </div>
  );
}

export function SupplierRoster({
  rows,
  loading,
  busyId,
  sessionUserId,
  isSuperAdmin,
  onApprove,
  onReject,
  onSuspend,
  onDocs,
  toolbar,
  empty,
}: {
  rows: Supplier[];
  loading?: boolean;
  busyId?: string | null;
  sessionUserId?: string | null;
  isSuperAdmin?: boolean;
  onApprove?: (s: Supplier) => void;
  onReject?: (s: Supplier) => void;
  onSuspend?: (s: Supplier) => void;
  onDocs?: (s: Supplier) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto_auto]';
  const showEmpty = !loading && rows.length === 0;

  return (
    <RosterShell
      toolbar={toolbar}
      loading={loading}
      empty={empty}
      rowsEmpty={showEmpty || (!!loading && rows.length === 0)}
      header={
        <div
          className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${grid}`}
        >
          <span>Supplier</span>
          <span>Contact</span>
          <span>Status</span>
          <span className="text-right"> </span>
        </div>
      }
    >
      <ul className="divide-y divide-[#f3f2f1]">
        {rows.map((r) => {
          const bg = avatarColor(r.id);
          const st = r.status.trim().toUpperCase();
          const own =
            !!sessionUserId &&
            !!r.createdBy &&
            r.createdBy === sessionUserId &&
            !isSuperAdmin;
          const canApprove =
            (st === 'PENDING' || st === 'REJECTED') && !own;
          const canReject = st === 'PENDING' && !own;
          const canSuspend = st === 'APPROVED';

          const actions = (
            <div className="flex flex-wrap justify-end gap-1">
              {onDocs ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => onDocs(r)}
                >
                  Docs
                </button>
              ) : null}
              {canReject ? (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busyId === r.id}
                  onClick={() => onReject?.(r)}
                >
                  Reject
                </button>
              ) : null}
              {canApprove ? (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busyId === r.id}
                  onClick={() => onApprove?.(r)}
                >
                  {busyId === r.id ? 'Approving…' : 'Approve'}
                </button>
              ) : null}
              {canSuspend ? (
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busyId === r.id}
                  onClick={() => onSuspend?.(r)}
                >
                  Suspend
                </button>
              ) : null}
            </div>
          );

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
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                            {r.name}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                            {r.code}
                          </p>
                        </div>
                        <StatusPill status={r.status} kind="supplier" />
                      </div>
                      <p className="mt-2 truncate text-[12px] text-[#605e5c]">
                        {r.email || r.phone || 'No contact'}
                        {r.tin ? ` · TIN ${r.tin}` : ''}
                      </p>
                    </div>
                  </div>
                  {actions}
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
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                        {r.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                        {r.code}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-0.5 text-[12px] text-[#605e5c]">
                    {r.email ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                        {r.email}
                      </p>
                    ) : null}
                    {r.phone ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                        {r.phone}
                      </p>
                    ) : null}
                    {!r.email && !r.phone ? (
                      <span className="text-[#a19f9d]">—</span>
                    ) : null}
                  </div>

                  <StatusPill status={r.status} kind="supplier" />

                  <div className="flex justify-end">{actions}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </RosterShell>
  );
}

export function PurchaseOrderRoster({
  rows,
  loading,
  supplierName,
  busyId,
  onSubmit,
  onApprove,
  toolbar,
  empty,
}: {
  rows: PurchaseOrder[];
  loading?: boolean;
  supplierName: Map<string, string>;
  busyId?: string | null;
  onSubmit?: (po: PurchaseOrder) => void;
  onApprove?: (po: PurchaseOrder) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto_auto_auto]';
  const showEmpty = !loading && rows.length === 0;

  return (
    <RosterShell
      toolbar={toolbar}
      loading={loading}
      empty={empty}
      rowsEmpty={showEmpty || (!!loading && rows.length === 0)}
      header={
        <div
          className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${grid}`}
        >
          <span>Purchase order</span>
          <span>Supplier</span>
          <span>Total</span>
          <span>Status</span>
          <span className="text-right"> </span>
        </div>
      }
    >
      <ul className="divide-y divide-[#f3f2f1]">
        {rows.map((r) => {
          const name =
            supplierName.get(r.supplierId) ??
            `Supplier ${r.supplierId.slice(0, 8)}`;
          const bg = avatarColor(r.supplierId);
          const s = r.status.trim().toUpperCase().replace(/[\s-]+/g, '_');

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
                      {initials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[13px] font-semibold text-[#1b1a19]">
                            {r.poNumber}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-[#605e5c]">
                            {name}
                          </p>
                        </div>
                        <StatusPill status={r.status} kind="po" />
                      </div>
                      <p className="mt-2 text-[15px] font-semibold tabular-nums text-[#1b1a19]">
                        {formatMoney(r.totalAmount, r.currency)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#8a8886]">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <PoActions
                    status={s}
                    busy={busyId === r.id}
                    onSubmit={() => onSubmit?.(r)}
                    onApprove={() => onApprove?.(r)}
                  />
                </div>

                <div
                  className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
                >
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-[#1b1a19]">
                      {r.poNumber}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8a8886]">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>

                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{
                        background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                      }}
                    >
                      {initials(name)}
                    </span>
                    <p className="truncate text-[13px] font-medium text-[#323130]">
                      {name}
                    </p>
                  </div>

                  <span className="text-[13px] font-semibold tabular-nums text-[#1b1a19]">
                    {formatMoney(r.totalAmount, r.currency)}
                  </span>

                  <StatusPill status={r.status} kind="po" />

                  <div className="flex flex-wrap justify-end gap-1">
                    <PoActions
                      status={s}
                      busy={busyId === r.id}
                      onSubmit={() => onSubmit?.(r)}
                      onApprove={() => onApprove?.(r)}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </RosterShell>
  );
}

function PoActions({
  status,
  busy,
  onSubmit,
  onApprove,
}: {
  status: string;
  busy?: boolean;
  onSubmit: () => void;
  onApprove: () => void;
}) {
  if (status === 'DRAFT') {
    return (
      <button
        type="button"
        className={btnPrimary}
        disabled={busy}
        onClick={onSubmit}
      >
        {busy ? 'Submitting…' : 'Submit'}
      </button>
    );
  }
  if (status === 'PENDING_APPROVAL' || status === 'SUBMITTED') {
    return (
      <button
        type="button"
        className={btnPrimary}
        disabled={busy}
        onClick={onApprove}
      >
        {busy ? 'Approving…' : 'Approve'}
      </button>
    );
  }
  return <span className="text-[11px] text-[#c8c6c4]">—</span>;
}

export function ProcurementEmpty({
  title,
  description,
  icon = 'truck',
}: {
  title: string;
  description: string;
  icon?: 'truck' | 'po';
}) {
  const Icon = icon === 'po' ? ClipboardList : Truck;
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

export function SubmissionRoster({
  rows,
  loading,
  busyId,
  sessionUserId,
  isSuperAdmin,
  onApprove,
  onReject,
  onMarkPaid,
  toolbar,
  empty,
}: {
  rows: SupplierSubmission[];
  loading?: boolean;
  busyId?: string | null;
  sessionUserId?: string | null;
  isSuperAdmin?: boolean;
  onApprove?: (row: SupplierSubmission) => void;
  onReject?: (row: SupplierSubmission) => void;
  onMarkPaid?: (row: SupplierSubmission) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto]';
  const showEmpty = !loading && rows.length === 0;

  return (
    <RosterShell
      toolbar={toolbar}
      loading={loading}
      empty={empty}
      rowsEmpty={showEmpty || (!!loading && rows.length === 0)}
      header={
        <div
          className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${grid}`}
        >
          <span>Submission</span>
          <span>Supplier</span>
          <span>Amount</span>
          <span>Status</span>
          <span className="text-right"> </span>
        </div>
      }
    >
      <ul className="divide-y divide-[#f3f2f1]">
        {rows.map((r) => {
          const own =
            !!sessionUserId &&
            r.createdBy === sessionUserId &&
            !isSuperAdmin;
          const canApprove = r.status === 'SUBMITTED' && !own;
          const canReject = r.status === 'SUBMITTED' && !own;
          const payable =
            r.status === 'APPROVED' &&
            (r.kind === 'INVOICE' || r.kind === 'PAYMENT_REQUEST') &&
            r.paymentStatus === 'UNPAID';

          return (
            <li key={r.id} className="px-4 py-3.5">
              <div
                className={`grid items-center gap-3 md:grid ${grid}`}
              >
                <div>
                  <p className="font-mono text-[12px] text-[#8a8886]">
                    {r.referenceNumber}
                    {r.poNumber ? ` · ${r.poNumber}` : ''}
                  </p>
                  <p className="text-[13.5px] font-semibold text-[#1b1a19]">
                    {r.kind.replace(/_/g, ' ')} · {r.title}
                  </p>
                  {r.rejectedReason ? (
                    <p className="mt-0.5 text-[11px] text-rose-700">
                      {r.rejectedReason}
                    </p>
                  ) : null}
                </div>
                <p className="text-[13px] text-[#323130]">
                  {r.supplierName ?? r.supplierCode ?? '—'}
                </p>
                <span className="text-[13px] font-semibold tabular-nums">
                  {r.amount != null
                    ? formatMoney(r.amount, r.currency)
                    : '—'}
                </span>
                <div className="flex flex-wrap gap-1">
                  <StatusPill status={r.status} kind="supplier" />
                  {r.paymentStatus && r.paymentStatus !== 'NONE' ? (
                    <StatusPill status={r.paymentStatus} kind="po" />
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {canReject ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === r.id}
                      onClick={() => onReject?.(r)}
                    >
                      Reject
                    </button>
                  ) : null}
                  {canApprove ? (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => onApprove?.(r)}
                    >
                      Approve
                    </button>
                  ) : null}
                  {payable ? (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => onMarkPaid?.(r)}
                    >
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </RosterShell>
  );
}
