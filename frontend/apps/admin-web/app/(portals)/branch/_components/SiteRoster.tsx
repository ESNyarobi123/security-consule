'use client';

import type { Site } from '@pssms/api-client';
import { Building2, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

function initials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        active
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
          : 'bg-slate-50 text-slate-600 ring-slate-200/80'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function SiteRoster({
  rows,
  loading,
  branchLabel,
  toolbar,
  empty,
}: {
  rows: Site[];
  loading?: boolean;
  branchLabel: (branchId: string) => string;
  toolbar?: ReactNode;
  empty?: ReactNode;
}) {
  const grid =
    'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto]';
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
        <span>Site</span>
        <span>Branch</span>
        <span>Status</span>
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
            const branch = branchLabel(r.branchId);

            return (
              <li key={r.id}>
                <div className="px-4 py-3.5 transition hover:bg-[#f3f9fd]/60">
                  {/* Mobile */}
                  <div className="space-y-2 md:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(r.code || r.name)}
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
                          <StatusPill active={r.isActive} />
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#605e5c]">
                          <Building2 className="h-3 w-3 shrink-0 text-[#a19f9d]" />
                          <span className="truncate">{branch}</span>
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                        style={{
                          background: `linear-gradient(145deg, ${bg}, color-mix(in srgb, ${bg} 70%, #0f172a))`,
                        }}
                      >
                        {initials(r.code || r.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-[#1b1a19]">
                          {r.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">
                          {r.code}
                          {r.customerId ? ' · Customer site' : ' · Facility'}
                        </p>
                      </div>
                    </div>

                    <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-[#605e5c]">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-[#a19f9d]" />
                      <span className="truncate">{branch}</span>
                    </p>

                    <StatusPill active={r.isActive} />
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

export function SitesEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6fc] text-[#0078d4]">
        <MapPin className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}
