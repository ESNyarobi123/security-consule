'use client';

import type { Customer } from '@pssms/api-client';
import {
  Building2,
  FileText,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
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
  if (parts.length === 0) return 'CU';
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

function StatusPill({
  active,
  status,
}: {
  active: boolean;
  status?: string | null;
}) {
  const s = (status ?? (active ? 'ACTIVE' : 'SUSPENDED')).toUpperCase();
  if (s === 'ACTIVE')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  if (s === 'PROSPECT')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Prospect
      </span>
    );
  if (s === 'TERMINATED')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Terminated
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200/80">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      Suspended
    </span>
  );
}

export function CustomersEmpty({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Building2 className="h-6 w-6 text-[#a19f9d]" />
      <p className="text-sm font-medium text-[#323130]">No customers registered</p>
      <p className="max-w-sm text-xs text-[#605e5c]">
        Register commercial customers who receive HIGHLINK security services.
        Sites and contracts are linked after registration.
      </p>
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 text-sm font-semibold text-[#0078d4] hover:underline"
        >
          Register first customer
        </button>
      ) : null}
    </div>
  );
}

export function CustomerRoster({
  rows,
  loading,
  onOpen,
  toolbar,
  empty,
}: {
  rows: Customer[];
  loading?: boolean;
  onOpen?: (row: Customer) => void;
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
        <div className="p-4">{empty ?? <CustomersEmpty />}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
      {toolbar ? (
        <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#faf9f8] text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="hidden px-4 py-3 lg:table-cell">Address</th>
              <th className="px-4 py-3 text-center">Sites</th>
              <th className="px-4 py-3 text-center">Contracts</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edebe9]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="h-10 rounded-lg bg-[#f3f2f1]" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const bg = avatarColor(row.id || row.code);
                  return (
                    <tr
                      key={row.id}
                      className={
                        onOpen
                          ? 'cursor-pointer transition-colors hover:bg-[#f3f9fd]'
                          : undefined
                      }
                      onClick={() => onOpen?.(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold tracking-wide text-white shadow-sm ring-2 ring-white"
                            style={{
                              background: `linear-gradient(145deg, ${bg} 0%, color-mix(in srgb, ${bg} 70%, #0f172a) 100%)`,
                            }}
                            aria-hidden
                          >
                            {initials(row.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#1b1a19]">
                              {row.name}
                            </p>
                            <p className="font-mono text-[11px] text-[#605e5c]">
                              {row.code}
                              {row.category ? (
                                <span className="text-[#a19f9d]"> · {row.category}</span>
                              ) : null}
                              {row.tin ? (
                                <span className="text-[#a19f9d]"> · TIN {row.tin}</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 text-xs text-[#323130]">
                          {row.contactPerson ? (
                            <p className="flex items-center gap-1.5 font-medium">
                              <UserRound className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                              <span className="truncate">{row.contactPerson}</span>
                            </p>
                          ) : (
                            <p className="text-[#a19f9d]">No contact person</p>
                          )}
                          <p className="flex items-center gap-1.5 text-[#605e5c]">
                            <Mail className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                            <span className="truncate">{row.email ?? '—'}</span>
                          </p>
                          <p className="flex items-center gap-1.5 text-[#605e5c]">
                            <Phone className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                            <span>{row.phone ?? '—'}</span>
                          </p>
                        </div>
                      </td>
                      <td className="hidden max-w-[220px] px-4 py-3 lg:table-cell">
                        <p className="flex items-start gap-1.5 text-xs text-[#605e5c]">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#a19f9d]" />
                          <span className="line-clamp-2">
                            {row.address ?? '—'}
                          </span>
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-semibold text-[#323130] ring-1 ring-[#e1dfdd]">
                          <MapPin className="h-3 w-3 text-[#605e5c]" />
                          {row.siteCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[11px] font-semibold text-[#323130] ring-1 ring-[#e1dfdd]">
                          <FileText className="h-3 w-3 text-[#605e5c]" />
                          {row.contractCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={row.isActive} status={row.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-[#605e5c] md:table-cell">
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
