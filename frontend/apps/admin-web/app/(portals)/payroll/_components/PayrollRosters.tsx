'use client';

import type { PayrollCycle, PayslipSnapshot } from '@pssms/api-client';
import { btnPrimary } from '@pssms/ui';
import {
  CalendarRange,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Play,
  Send,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);
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

function cycleStatusTone(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  const s = status.trim().toUpperCase();
  if (s === 'DRAFT')
    return {
      label: 'Draft',
      className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
      dot: 'bg-slate-400',
    };
  if (s === 'CALCULATED')
    return {
      label: 'Calculated',
      className: 'bg-sky-50 text-sky-800 ring-sky-200/80',
      dot: 'bg-sky-500',
    };
  if (s === 'PENDING_APPROVAL')
    return {
      label: 'Pending approval',
      className: 'bg-amber-50 text-amber-900 ring-amber-200/80',
      dot: 'bg-amber-500',
    };
  if (s === 'APPROVED')
    return {
      label: 'Approved',
      className: 'bg-violet-50 text-violet-800 ring-violet-200/80',
      dot: 'bg-violet-500',
    };
  if (s === 'PAID')
    return {
      label: 'Paid',
      className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      dot: 'bg-emerald-500',
    };
  return {
    label: status.replace(/_/g, ' '),
    className: 'bg-slate-50 text-slate-700 ring-slate-200/80',
    dot: 'bg-slate-400',
  };
}

function StatusPill({ status }: { status: string }) {
  const tone = cycleStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function CycleAvatar({ code }: { code: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0078d4] to-[#0d9488] text-white shadow-sm ring-2 ring-white">
      <CalendarRange className="h-4 w-4" />
      <span className="sr-only">{code}</span>
    </span>
  );
}

function ListShell({
  toolbar,
  headers,
  headerClassName,
  loading,
  isEmpty,
  empty,
  children,
}: {
  toolbar?: ReactNode;
  headers: string[];
  headerClassName: string;
  loading?: boolean;
  isEmpty?: boolean;
  empty?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}
      <div
        className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${headerClassName}`}
      >
        {headers.map((h, i) => (
          <span key={`${i}-${h || 'col'}`}>{h}</span>
        ))}
      </div>
      {loading ? (
        <ul className="divide-y divide-[#f3f2f1]">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="animate-pulse px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#edebe9]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 rounded bg-[#edebe9]" />
                  <div className="h-2.5 w-48 rounded bg-[#f3f2f1]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : isEmpty ? (
        <div className="p-4">{empty}</div>
      ) : (
        <ul className="divide-y divide-[#f3f2f1]">{children}</ul>
      )}
    </div>
  );
}

export function PayrollCycleRoster({
  rows,
  loading,
  selectedId,
  busyId,
  onOpenPayslips,
  onAction,
  toolbar,
  empty,
}: {
  rows: PayrollCycle[];
  loading?: boolean;
  selectedId?: string | null;
  busyId?: string | null;
  onOpenPayslips: (id: string) => void;
  onAction: (
    cycle: PayrollCycle,
    action: 'generate' | 'submit' | 'approve' | 'pay',
  ) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto_minmax(0,1.4fr)]';

  return (
    <ListShell
      toolbar={toolbar}
      headers={['Cycle', 'Period', 'Status', 'Created', 'Actions']}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      isEmpty={rows.length === 0}
      empty={empty}
    >
      {rows.map((r) => {
        const selected = selectedId === r.id;
        const busy = busyId === r.id;
        return (
          <li key={r.id}>
            <div
              className={`px-4 py-3.5 transition ${
                selected
                  ? 'bg-[#eff6fc]/90 ring-1 ring-inset ring-[#c7e0f4]'
                  : 'hover:bg-[#f3f9fd]/60'
              }`}
            >
              {/* Mobile */}
              <div className="space-y-2.5 md:hidden">
                <div className="flex items-start gap-3">
                  <CycleAvatar code={r.cycleCode} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[13px] font-semibold text-[#1b1a19]">
                        {r.cycleCode}
                      </p>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-1 text-[12px] tabular-nums text-[#605e5c]">
                      {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#a19f9d]">
                      Created {formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>
                <CycleActions
                  cycle={r}
                  busy={busy}
                  selected={selected}
                  onOpenPayslips={onOpenPayslips}
                  onAction={onAction}
                />
              </div>

              {/* Desktop */}
              <div
                className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CycleAvatar code={r.cycleCode} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13.5px] font-semibold text-[#1b1a19]">
                      {r.cycleCode}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8a8886]">
                      {r.tenantType?.replace(/_/g, ' ') || 'Internal company'}
                    </p>
                  </div>
                </div>
                <div className="text-[12px] tabular-nums text-[#605e5c]">
                  <p className="font-medium text-[#323130]">
                    {formatDate(r.periodStart)}
                  </p>
                  <p className="text-[11px] text-[#a19f9d]">
                    → {formatDate(r.periodEnd)}
                  </p>
                </div>
                <StatusPill status={r.status} />
                <span className="text-[12px] tabular-nums text-[#605e5c]">
                  {formatDate(r.createdAt)}
                </span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <CycleActions
                    cycle={r}
                    busy={busy}
                    selected={selected}
                    onOpenPayslips={onOpenPayslips}
                    onAction={onAction}
                  />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ListShell>
  );
}

function CycleActions({
  cycle,
  busy,
  selected,
  onOpenPayslips,
  onAction,
}: {
  cycle: PayrollCycle;
  busy?: boolean;
  selected?: boolean;
  onOpenPayslips: (id: string) => void;
  onAction: (
    cycle: PayrollCycle,
    action: 'generate' | 'submit' | 'approve' | 'pay',
  ) => void;
}) {
  const s = cycle.status;
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => onOpenPayslips(cycle.id)}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition ${
          selected
            ? 'bg-[#0078d4] text-white'
            : 'border border-[#e1dfdd] bg-white text-[#323130] hover:border-[#0078d4]/50 hover:text-[#0078d4]'
        }`}
      >
        <FileSpreadsheet className="h-3 w-3" />
        Payslips
        {selected ? <ChevronRight className="h-3 w-3" /> : null}
      </button>
      {s === 'DRAFT' ? (
        <button
          type="button"
          disabled={busy}
          className={btnPrimary}
          onClick={() => onAction(cycle, 'generate')}
        >
          <Play className="h-3 w-3" />
          Generate
        </button>
      ) : null}
      {s === 'CALCULATED' ? (
        <button
          type="button"
          disabled={busy}
          className={btnPrimary}
          onClick={() => onAction(cycle, 'submit')}
        >
          <Send className="h-3 w-3" />
          Submit
        </button>
      ) : null}
      {s === 'PENDING_APPROVAL' ? (
        <button
          type="button"
          disabled={busy}
          className={btnPrimary}
          onClick={() => onAction(cycle, 'approve')}
        >
          <Check className="h-3 w-3" />
          Approve
        </button>
      ) : null}
      {s === 'APPROVED' ? (
        <button
          type="button"
          disabled={busy}
          className={btnPrimary}
          onClick={() => onAction(cycle, 'pay')}
        >
          <Wallet className="h-3 w-3" />
          Mark paid
        </button>
      ) : null}
    </>
  );
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
] as const;

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length]!;
}

export function PayslipRoster({
  rows,
  empty,
  toolbar,
  onView,
}: {
  rows: PayslipSnapshot[];
  empty?: ReactNode;
  toolbar?: ReactNode;
  onView?: (id: string) => void;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]';

  return (
    <ListShell
      toolbar={toolbar}
      headers={['Employee', 'Gross', 'Deductions', 'Net pay', '']}
      headerClassName={grid}
      isEmpty={rows.length === 0}
      empty={empty}
    >
      {rows.map((r) => {
        const bg = avatarColor(r.employeeId || r.employeeNumber);
        return (
          <li key={r.id}>
            <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
              <div className="flex gap-3 md:hidden">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                  style={{ background: bg }}
                >
                  {initials(r.employeeName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                    {r.employeeName}
                  </p>
                  <p className="font-mono text-[11px] text-[#8a8886]">
                    {r.employeeNumber}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-[#a19f9d]">Gross</p>
                      <p className="font-medium tabular-nums text-[#323130]">
                        {money(r.grossPay)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#a19f9d]">Deduct</p>
                      <p className="font-medium tabular-nums text-[#323130]">
                        {money(r.totalDeductions)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#a19f9d]">Net</p>
                      <p className="font-semibold tabular-nums text-emerald-700">
                        {money(r.netPay)}
                      </p>
                    </div>
                  </div>
                  {onView ? (
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-semibold text-[#0078d4]"
                      onClick={() => onView(r.id)}
                    >
                      View payslip
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className={`hidden md:grid md:items-center md:gap-3 ${grid}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                    style={{
                      background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                    }}
                  >
                    {initials(r.employeeName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                      {r.employeeName}
                    </p>
                    <p className="font-mono text-[11px] text-[#8a8886]">
                      {r.employeeNumber}
                    </p>
                  </div>
                </div>
                <span className="text-[13px] tabular-nums text-[#323130]">
                  {money(r.grossPay)}
                </span>
                <span className="text-[13px] tabular-nums text-[#605e5c]">
                  {money(r.totalDeductions)}
                </span>
                <span className="inline-flex w-fit rounded-lg bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-200/80">
                  {money(r.netPay)}
                </span>
                {onView ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[#0078d4] hover:underline"
                    onClick={() => onView(r.id)}
                  >
                    View
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ListShell>
  );
}
