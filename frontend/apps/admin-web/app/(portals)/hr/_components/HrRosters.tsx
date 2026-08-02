'use client';

import type {
  DisciplineCase,
  EmployeeMovement,
  LeaveRequest,
  SalaryAssignment,
  TrainingRecord,
} from '@pssms/api-client';
import { btnPrimary, btnSecondary } from '@pssms/ui';
import type { ReactNode } from 'react';
import {
  HrListShell,
  PersonCell,
  StatusPill,
  TypeChip,
  movementTypeTone,
  severityTone,
  workflowStatusTone,
} from './hr-list';
import { formatDate, formatMoney } from './shared';

type NameMap = Map<string, string>;

function resolveName(map: NameMap, id: string) {
  return map.get(id) ?? `Employee ${id.slice(0, 8)}`;
}

function ResponsiveRow({
  mobile,
  desktop,
  gridClass,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
  gridClass: string;
}) {
  return (
    <li>
      <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
        <div className="md:hidden">{mobile}</div>
        <div
          className={`hidden md:grid md:items-center md:gap-3 ${gridClass}`}
        >
          {desktop}
        </div>
      </div>
    </li>
  );
}

// ── Leave ──────────────────────────────────────────────

export function LeaveRequestRoster({
  rows,
  loading,
  employeeName,
  leaveTypeName,
  compact,
  busyId,
  canAct,
  onApprove,
  onReject,
  empty,
  toolbar,
}: {
  rows: LeaveRequest[];
  loading?: boolean;
  employeeName: NameMap;
  leaveTypeName: NameMap;
  compact?: boolean;
  busyId?: string | null;
  canAct?: (r: LeaveRequest) => boolean | 'own';
  onApprove?: (id: string) => void;
  onReject?: (r: LeaveRequest) => void;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const grid = compact
    ? 'md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto_auto]'
    : 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto]';
  const headers = compact
    ? ['Employee', 'Type', 'Dates', 'Days', 'Status']
    : ['Employee', 'Type', 'Dates', 'Days', 'Reason', 'Status', ''];

  return (
    <HrListShell
      toolbar={toolbar}
      headers={headers}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      empty={empty}
      isEmpty={rows.length === 0}
    >
      {rows.map((r) => {
        const name = resolveName(employeeName, r.employeeId);
        const type = leaveTypeName.get(r.leaveTypeId) ?? 'Leave';
        const tone = workflowStatusTone(r.status);
        const act = canAct?.(r);
        return (
          <ResponsiveRow
            key={r.id}
            gridClass={grid}
            mobile={
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell
                    name={name}
                    seed={r.employeeId}
                    subtitle={type}
                  />
                  <StatusPill {...tone} />
                </div>
                <p className="text-[12px] text-[#605e5c]">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)} ·{' '}
                  <span className="font-semibold text-[#323130]">
                    {r.days}d
                  </span>
                </p>
                {!compact && r.reason ? (
                  <p className="truncate text-[11px] text-[#8a8886]" title={r.reason}>
                    {r.reason}
                  </p>
                ) : null}
                {act === true ? (
                  <div className="flex gap-1 pt-1">
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => onApprove?.(r.id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === r.id}
                      onClick={() => onReject?.(r)}
                    >
                      Reject
                    </button>
                  </div>
                ) : act === 'own' ? (
                  <p className="text-[11px] text-[#a19f9d]">
                    Awaiting other approver
                  </p>
                ) : null}
              </div>
            }
            desktop={
              <>
                <PersonCell name={name} seed={r.employeeId} />
                <TypeChip
                  label={type}
                  className="bg-sky-50 text-sky-800 ring-sky-200/80"
                />
                <div className="text-[12px] tabular-nums text-[#605e5c]">
                  <p>{formatDate(r.startDate)}</p>
                  <p className="text-[11px] text-[#a19f9d]">
                    → {formatDate(r.endDate)}
                  </p>
                </div>
                <span className="inline-flex min-w-[2rem] justify-center rounded-lg bg-[#f3f2f1] px-2 py-1 text-[12px] font-semibold tabular-nums text-[#323130]">
                  {r.days}d
                </span>
                {!compact ? (
                  <p
                    className="truncate text-[12px] text-[#605e5c]"
                    title={r.reason}
                  >
                    {r.reason || '—'}
                  </p>
                ) : null}
                <StatusPill {...tone} />
                {!compact ? (
                  <div className="flex justify-end gap-1">
                    {act === true ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id}
                          onClick={() => onApprove?.(r.id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busyId === r.id}
                          onClick={() => onReject?.(r)}
                        >
                          Reject
                        </button>
                      </>
                    ) : act === 'own' ? (
                      <span className="text-[11px] text-[#a19f9d]">
                        Awaiting other
                      </span>
                    ) : r.rejectedReason ? (
                      <span
                        className="max-w-[100px] truncate text-[11px] text-rose-700"
                        title={r.rejectedReason}
                      >
                        {r.rejectedReason}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#c8c6c4]">—</span>
                    )}
                  </div>
                ) : null}
              </>
            }
          />
        );
      })}
    </HrListShell>
  );
}

// ── Salary ─────────────────────────────────────────────

export function SalaryRoster({
  rows,
  loading,
  employeeName,
  compact,
  empty,
  toolbar,
}: {
  rows: SalaryAssignment[];
  loading?: boolean;
  employeeName: NameMap;
  compact?: boolean;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const grid = compact
    ? 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto]'
    : 'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto_auto]';
  const headers = compact
    ? ['Employee', 'Basic', 'From', 'Status']
    : ['Employee', 'Basic', 'Hourly', 'From', 'Until', 'Status'];

  return (
    <HrListShell
      toolbar={toolbar}
      headers={headers}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      empty={empty}
      isEmpty={rows.length === 0}
    >
      {rows.map((r) => {
        const name = resolveName(employeeName, r.employeeId);
        const tone = workflowStatusTone(r.isActive ? 'ACTIVE' : 'INACTIVE');
        return (
          <ResponsiveRow
            key={r.id}
            gridClass={grid}
            mobile={
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell name={name} seed={r.employeeId} />
                  <StatusPill {...tone} />
                </div>
                <p className="text-[15px] font-semibold tabular-nums text-[#1b1a19]">
                  {formatMoney(r.basicSalary, r.currency)}
                </p>
                <p className="text-[11px] text-[#8a8886]">
                  From {formatDate(r.effectiveFrom)}
                </p>
              </div>
            }
            desktop={
              <>
                <PersonCell name={name} seed={r.employeeId} />
                <div>
                  <p className="text-[14px] font-semibold tabular-nums text-[#1b1a19]">
                    {formatMoney(r.basicSalary, r.currency)}
                  </p>
                  <p className="font-mono text-[10px] text-[#a19f9d]">
                    {r.currency}
                  </p>
                </div>
                {!compact ? (
                  <span className="text-[12px] tabular-nums text-[#605e5c]">
                    {r.hourlyRate != null
                      ? formatMoney(r.hourlyRate, r.currency)
                      : '—'}
                  </span>
                ) : null}
                <span className="text-[12px] tabular-nums text-[#605e5c]">
                  {formatDate(r.effectiveFrom)}
                </span>
                {!compact ? (
                  <span className="text-[12px] tabular-nums text-[#605e5c]">
                    {formatDate(r.effectiveUntil)}
                  </span>
                ) : null}
                <StatusPill {...tone} />
              </>
            }
          />
        );
      })}
    </HrListShell>
  );
}

// ── Training ───────────────────────────────────────────

export function TrainingRoster({
  rows,
  loading,
  employeeName,
  compact,
  busyId,
  onComplete,
  onCancel,
  empty,
  toolbar,
}: {
  rows: TrainingRecord[];
  loading?: boolean;
  employeeName: NameMap;
  compact?: boolean;
  busyId?: string | null;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const grid = compact
    ? 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto]'
    : 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto_auto_auto]';
  const headers = compact
    ? ['Employee', 'Course', 'Dates', 'Status']
    : ['Employee', 'Course', 'Provider', 'Dates', 'Status', ''];

  return (
    <HrListShell
      toolbar={toolbar}
      headers={headers}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      empty={empty}
      isEmpty={rows.length === 0}
    >
      {rows.map((r) => {
        const name = resolveName(employeeName, r.employeeId);
        const tone = workflowStatusTone(r.status);
        const planned = r.status.trim().toUpperCase() === 'PLANNED';
        return (
          <ResponsiveRow
            key={r.id}
            gridClass={grid}
            mobile={
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell
                    name={name}
                    seed={r.employeeId}
                    subtitle={r.title}
                  />
                  <StatusPill {...tone} />
                </div>
                <p className="text-[11px] text-[#8a8886]">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)}
                </p>
                {!compact && planned ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => onComplete?.(r.id)}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === r.id}
                      onClick={() => onCancel?.(r.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            }
            desktop={
              <>
                <PersonCell name={name} seed={r.employeeId} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#1b1a19]">
                    {r.title}
                  </p>
                  {!compact && r.notes ? (
                    <p
                      className="mt-0.5 truncate text-[11px] text-[#a19f9d]"
                      title={r.notes}
                    >
                      {r.notes}
                    </p>
                  ) : null}
                </div>
                {!compact ? (
                  <span className="truncate text-[12px] text-[#605e5c]">
                    {r.provider ?? '—'}
                  </span>
                ) : null}
                <div className="text-[12px] tabular-nums text-[#605e5c]">
                  <p>{formatDate(r.startDate)}</p>
                  <p className="text-[11px] text-[#a19f9d]">
                    → {formatDate(r.endDate)}
                  </p>
                </div>
                <StatusPill {...tone} />
                {!compact ? (
                  <div className="flex justify-end gap-1">
                    {planned ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id}
                          onClick={() => onComplete?.(r.id)}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busyId === r.id}
                          onClick={() => onCancel?.(r.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#c8c6c4]">—</span>
                    )}
                  </div>
                ) : null}
              </>
            }
          />
        );
      })}
    </HrListShell>
  );
}

// ── Discipline ─────────────────────────────────────────

export function DisciplineRoster({
  rows,
  loading,
  employeeName,
  compact,
  onClose,
  empty,
  toolbar,
}: {
  rows: DisciplineCase[];
  loading?: boolean;
  employeeName: NameMap;
  compact?: boolean;
  onClose?: (r: DisciplineCase) => void;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const grid = compact
    ? 'md:grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto]'
    : 'md:grid-cols-[minmax(0,1.1fr)_auto_auto_minmax(0,1.2fr)_auto_auto]';
  const headers = compact
    ? ['Employee', 'Incident', 'Category', 'Severity', 'Status']
    : ['Employee', 'Incident', 'Category', 'Description', 'Severity', ''];

  return (
    <HrListShell
      toolbar={toolbar}
      headers={headers}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      empty={empty}
      isEmpty={rows.length === 0}
    >
      {rows.map((r) => {
        const name = resolveName(employeeName, r.employeeId);
        const status = workflowStatusTone(r.status);
        const sev = severityTone(r.severity);
        const open = r.status.trim().toUpperCase() === 'OPEN';
        return (
          <ResponsiveRow
            key={r.id}
            gridClass={grid}
            mobile={
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell
                    name={name}
                    seed={r.employeeId}
                    subtitle={r.category}
                  />
                  <StatusPill {...status} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <TypeChip {...sev} />
                  <span className="text-[11px] text-[#8a8886]">
                    {formatDate(r.incidentDate)}
                  </span>
                </div>
                <p className="line-clamp-2 text-[12px] text-[#605e5c]">
                  {r.description}
                </p>
                {!compact && open ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => onClose?.(r)}
                  >
                    Close case
                  </button>
                ) : null}
              </div>
            }
            desktop={
              <>
                <PersonCell name={name} seed={r.employeeId} />
                <span className="text-[12px] tabular-nums text-[#605e5c]">
                  {formatDate(r.incidentDate)}
                </span>
                <span className="truncate text-[12px] font-medium text-[#323130]">
                  {r.category}
                </span>
                {compact ? (
                  <TypeChip {...sev} />
                ) : (
                  <p
                    className="truncate text-[12px] text-[#605e5c]"
                    title={r.description}
                  >
                    {r.description}
                  </p>
                )}
                {compact ? (
                  <StatusPill {...status} />
                ) : (
                  <>
                    <TypeChip {...sev} />
                    <div className="flex items-center justify-end gap-2">
                      <StatusPill {...status} />
                      {open ? (
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => onClose?.(r)}
                        >
                          Close
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            }
          />
        );
      })}
    </HrListShell>
  );
}

// ── Movements ──────────────────────────────────────────

export function MovementRoster({
  rows,
  loading,
  employeeName,
  compact,
  busyId,
  canAct,
  onApprove,
  onReject,
  empty,
  toolbar,
}: {
  rows: EmployeeMovement[];
  loading?: boolean;
  employeeName: NameMap;
  compact?: boolean;
  busyId?: string | null;
  canAct?: (r: EmployeeMovement) => boolean | 'own';
  onApprove?: (id: string) => void;
  onReject?: (r: EmployeeMovement) => void;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const grid = compact
    ? 'md:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)_auto_auto]'
    : 'md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto]';
  const headers = compact
    ? ['Employee', 'Type', 'Route', 'Effective', 'Status']
    : ['Employee', 'Type', 'Route', 'Effective', 'Reason', 'Status', ''];

  return (
    <HrListShell
      toolbar={toolbar}
      headers={headers}
      headerClassName={grid}
      loading={loading && rows.length === 0}
      empty={empty}
      isEmpty={rows.length === 0}
    >
      {rows.map((r) => {
        const name = resolveName(employeeName, r.employeeId);
        const status = workflowStatusTone(r.status);
        const type = movementTypeTone(r.type);
        const act = canAct?.(r);
        const route = `${r.fromDepartment ?? '—'} → ${r.toDepartment ?? '—'}`;
        return (
          <ResponsiveRow
            key={r.id}
            gridClass={grid}
            mobile={
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell name={name} seed={r.employeeId} />
                  <StatusPill {...status} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TypeChip {...type} />
                  <span className="text-[11px] text-[#8a8886]">
                    {formatDate(r.effectiveDate)}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-[#323130]">{route}</p>
                {!compact && act === true ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busyId === r.id}
                      onClick={() => onApprove?.(r.id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busyId === r.id}
                      onClick={() => onReject?.(r)}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            }
            desktop={
              <>
                <PersonCell name={name} seed={r.employeeId} />
                <TypeChip {...type} />
                <span className="truncate text-[12px] font-medium text-[#323130]">
                  {route}
                </span>
                <span className="text-[12px] tabular-nums text-[#605e5c]">
                  {formatDate(r.effectiveDate)}
                </span>
                {!compact ? (
                  <p
                    className="truncate text-[12px] text-[#605e5c]"
                    title={r.reason}
                  >
                    {r.reason}
                  </p>
                ) : null}
                <StatusPill {...status} />
                {!compact ? (
                  <div className="flex justify-end gap-1">
                    {act === true ? (
                      <>
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === r.id}
                          onClick={() => onApprove?.(r.id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={busyId === r.id}
                          onClick={() => onReject?.(r)}
                        >
                          Reject
                        </button>
                      </>
                    ) : act === 'own' ? (
                      <span className="text-[11px] text-[#a19f9d]">
                        Awaiting other
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#c8c6c4]">—</span>
                    )}
                  </div>
                ) : null}
              </>
            }
          />
        );
      })}
    </HrListShell>
  );
}
