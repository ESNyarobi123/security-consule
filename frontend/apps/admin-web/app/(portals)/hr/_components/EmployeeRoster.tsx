'use client';

import type { Employee } from '@pssms/api-client';
import { Link2, Link2Off, Mail, Pencil, Phone, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  avatarColor,
  employeeInitials,
  employeeStatusTone,
  employmentTypeTone,
} from './employee-ui';
import { formatDate } from './shared';

function EmployeeAvatar({ employee }: { employee: Employee }) {
  const bg = avatarColor(employee.id || employee.employeeNumber);
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold tracking-wide text-white shadow-sm ring-2 ring-white"
      style={{
        background: `linear-gradient(145deg, ${bg} 0%, color-mix(in srgb, ${bg} 70%, #0f172a) 100%)`,
      }}
      aria-hidden
    >
      {employeeInitials(employee.fullName)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = employeeStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const tone = employmentTypeTone(type);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
    >
      {tone.label}
    </span>
  );
}

function EssPill({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
        <Link2 className="h-3 w-3" />
        ESS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8a8886] ring-1 ring-[#e1dfdd]">
      <Link2Off className="h-3 w-3" />
      No ESS
    </span>
  );
}

export function EmployeeRoster({
  rows,
  loading,
  compact = false,
  onEdit,
  toolbar,
  empty,
}: {
  rows: Employee[];
  loading?: boolean;
  /** Overview preview — fewer columns, denser rows */
  compact?: boolean;
  onEdit?: (employee: Employee) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  if (!loading && rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
        {toolbar ? (
          <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
            {toolbar}
          </div>
        ) : null}
        <div className="p-4">
          {empty ?? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="h-5 w-5 text-[#a19f9d]" />
              <p className="text-sm font-medium text-[#323130]">No employees</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-gradient-to-r from-[#f8fafc] via-[#faf9f8] to-[#eff6fc]/40 px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      {/* Column headers — desktop */}
      <div
        className={`hidden border-b border-[#edebe9] bg-[#faf9f8]/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8886] md:grid md:items-center md:gap-3 ${
          compact
            ? 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_auto_auto]'
            : 'md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_auto_auto_auto_6.5rem_auto]'
        }`}
      >
        <span>Employee</span>
        <span>Department</span>
        <span>Role</span>
        {!compact ? <span>ESS</span> : null}
        <span>Status</span>
        {!compact ? <span>Hired</span> : null}
        {!compact && onEdit ? <span className="text-right"> </span> : null}
      </div>

      <ul className="divide-y divide-[#f3f2f1]">
        {loading && rows.length === 0
          ? Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
              <li key={`sk-${i}`} className="animate-pulse px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#edebe9]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 rounded bg-[#edebe9]" />
                    <div className="h-2.5 w-24 rounded bg-[#f3f2f1]" />
                  </div>
                </div>
              </li>
            ))
          : rows.map((r) => {
              const interactive = Boolean(onEdit);
              return (
                <li key={r.id}>
                  <div
                    className={`group relative px-4 py-3.5 transition ${
                      interactive
                        ? 'cursor-pointer hover:bg-[#f3f9fd]/70'
                        : 'hover:bg-[#faf9f8]/80'
                    }`}
                    onClick={
                      interactive
                        ? () => {
                            onEdit?.(r);
                          }
                        : undefined
                    }
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onEdit?.(r);
                            }
                          }
                        : undefined
                    }
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                  >
                    {/* Mobile stack */}
                    <div className="flex gap-3 md:hidden">
                      <EmployeeAvatar employee={r} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#1b1a19]">
                              {r.fullName}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                              {r.employeeNumber}
                            </p>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <TypePill type={r.employmentType} />
                          {!compact ? (
                            <EssPill linked={Boolean(r.userId)} />
                          ) : null}
                          {r.department ? (
                            <span className="rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-medium text-[#605e5c]">
                              {r.department}
                            </span>
                          ) : null}
                        </div>
                        {(r.email || r.phone) && !compact ? (
                          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8a8886]">
                            {r.email ? (
                              <span className="inline-flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 shrink-0" />
                                {r.email}
                              </span>
                            ) : null}
                            {r.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {r.phone}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Desktop grid */}
                    <div
                      className={`hidden md:grid md:items-center md:gap-3 ${
                        compact
                          ? 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_auto_auto]'
                          : 'md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_auto_auto_auto_6.5rem_auto]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <EmployeeAvatar employee={r} />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-[#1b1a19] group-hover:text-[#0078d4]">
                            {r.fullName}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#8a8886]">
                            {r.employeeNumber}
                          </p>
                          {!compact && (r.email || r.phone) ? (
                            <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[#a19f9d]">
                              {r.email ? (
                                <span className="inline-flex max-w-[180px] items-center gap-1 truncate">
                                  <Mail className="h-3 w-3 shrink-0 opacity-70" />
                                  {r.email}
                                </span>
                              ) : null}
                              {r.phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3 shrink-0 opacity-70" />
                                  {r.phone}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0">
                        {r.department ? (
                          <span className="inline-flex max-w-full truncate rounded-lg border border-[#edebe9] bg-[#faf9f8] px-2.5 py-1 text-[12px] font-medium text-[#323130]">
                            {r.department}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#c8c6c4]">—</span>
                        )}
                      </div>

                      <div>
                        <TypePill type={r.employmentType} />
                      </div>

                      {!compact ? (
                        <div>
                          <EssPill linked={Boolean(r.userId)} />
                        </div>
                      ) : null}

                      <div>
                        <StatusPill status={r.status} />
                      </div>

                      {!compact ? (
                        <div className="text-[12px] tabular-nums text-[#605e5c]">
                          {formatDate(r.hireDate)}
                        </div>
                      ) : null}

                      {!compact && onEdit ? (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-[#e1dfdd] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#323130] shadow-sm transition hover:border-[#0078d4]/50 hover:text-[#0078d4]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(r);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
      </ul>
    </div>
  );
}
