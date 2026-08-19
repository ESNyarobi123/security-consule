'use client';

import {
  getPortalCatalog,
  type PortalCatalog,
  type PortalCatalogPortal,
} from '@pssms/api-client';
import { GlassCard } from '@pssms/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

function RoleChip({
  code,
  present,
  canEnter,
  userCount,
  publicAccess,
}: {
  code: string;
  present: boolean;
  canEnter: boolean;
  userCount: number;
  publicAccess: boolean;
}) {
  const tone = !present
    ? 'bg-amber-50 text-amber-900 ring-amber-200'
    : publicAccess || canEnter
      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      : 'bg-rose-50 text-rose-900 ring-rose-200';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ring-1 ${tone}`}
      title={
        !present
          ? 'Role not seeded in this organisation'
          : publicAccess
            ? 'Lane or public entry — not an ops manage grant'
            : canEnter
              ? 'Has a staff gate permission for this portal'
              : 'Role exists but lacks this portal’s staff gate permission'
      }
    >
      {code}
      <span className="font-sans text-[#8a8886]">{userCount}</span>
    </span>
  );
}

function PortalCard({ p }: { p: PortalCatalogPortal }) {
  return (
    <GlassCard glow="none" className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#8a8886]">
            Portal {p.id}
          </p>
          <h2 className="text-sm font-semibold text-[#1b1a19]">{p.name}</h2>
        </div>
        <span className="shrink-0 rounded-md bg-[#f3f2f1] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#605e5c]">
          {p.publicAccess ? 'Public + lanes' : 'RBAC gate'}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#605e5c]">{p.job}</p>
      <p className="mt-2 text-[11px] text-[#323130]">
        <span className="font-medium">Users: </span>
        {p.primaryUsers}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-[#8a8886]">{p.entry}</p>
      {p.gatePermissions.length ? (
        <p className="mt-2 font-mono text-[11px] text-[#0078d4]">
          {p.gatePermissions.join(' · ')}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-[#605e5c]">No login gate (public book / apply)</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {p.roles.map((r) => (
          <RoleChip
            key={r.code}
            code={r.code}
            present={r.present}
            canEnter={r.canEnter}
            userCount={r.userCount}
            publicAccess={p.publicAccess}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#605e5c]">{p.security}</p>
      <p className="mt-2 text-[11px] text-[#8a8886]">
        {p.liveUserCount} bound account{p.liveUserCount === 1 ? '' : 's'} on listed roles
      </p>
    </GlassCard>
  );
}

export default function SuperAdminPortalsPage() {
  const [data, setData] = useState<PortalCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'portals' | 'accounts'>('portals');

  useEffect(() => {
    void getPortalCatalog()
      .then(setData)
      .catch((err) => setError(formatApiError(err)));
  }, []);

  const portals = useMemo(() => {
    const rows = data?.portals ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.id.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.roleCodes.join(' ').toLowerCase().includes(q) ||
        p.gatePermissions.join(' ').toLowerCase().includes(q) ||
        p.entry.toLowerCase().includes(q),
    );
  }, [data, query]);

  const accounts = useMemo(() => {
    const rows = data?.accountTypes ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.roleCodes.join(' ').toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a19]">
            Portals, accounts & roles
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
            Design §35 applications and §36 account types, joined to this
            organisation’s live IAM roles and user counts. Green chips mean the
            listed <span className="font-medium">staff</span> role holds this
            portal’s gate permission — they are not a prompt to grant manage
            rights to self-service or public lanes. Demo logins stay on the{' '}
            <Link href="/portal-directory" className="text-[#0078d4] hover:underline">
              portal directory
            </Link>
            .
          </p>
        </div>
        <input
          className={fieldCls}
          placeholder="Filter portal, role, permission"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-1 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1">
        {(
          [
            ['portals', '24 portals'],
            ['accounts', '20 account types'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === id
                ? 'bg-white text-[#0078d4] shadow-sm ring-1 ring-[#e1dfdd]'
                : 'text-[#605e5c]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {!data && !error ? (
        <p className="text-sm text-[#605e5c]">Loading catalog…</p>
      ) : null}

      {tab === 'portals' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {portals.map((p) => (
            <PortalCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e1dfdd] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf9f8] text-[11px] uppercase tracking-wide text-[#605e5c]">
              <tr>
                <th className="px-3 py-2 font-medium">Account type</th>
                <th className="px-3 py-2 font-medium">Seeded roles</th>
                <th className="px-3 py-2 font-medium">Portals</th>
                <th className="px-3 py-2 font-medium">Users</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.code} className="border-t border-[#edebe9]">
                  <td className="px-3 py-2">
                    <p className="font-medium text-[#1b1a19]">{a.name}</p>
                    <p className="font-mono text-[11px] text-[#8a8886]">{a.code}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#323130]">
                    {a.publicOrUnbound
                      ? 'Public — no login account'
                      : a.roleCodes.join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#605e5c]">
                    {a.portalIds.join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-[#323130]">{a.liveUserCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.unmappedRoleCodes?.length ? (
        <p className="text-xs text-amber-800">
          Org roles not on this design map:{' '}
          <span className="font-mono">{data.unmappedRoleCodes.join(', ')}</span>
        </p>
      ) : null}
    </div>
  );
}
