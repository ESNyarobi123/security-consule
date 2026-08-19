'use client';

import {
  listPermissions,
  type PermissionCatalogItem,
} from '@pssms/api-client';
import { GlassCard } from '@pssms/ui';
import { useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

export default function SuperAdminModulesPage() {
  const [rows, setRows] = useState<PermissionCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void listPermissions()
      .then(setRows)
      .catch((err) => setError(formatApiError(err)));
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const p of rows) {
      if (
        q &&
        !p.module.toLowerCase().includes(q) &&
        !p.code.toLowerCase().includes(q) &&
        !p.name.toLowerCase().includes(q)
      ) {
        continue;
      }
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a19]">Modules</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#605e5c]">
            Live permission modules from IAM — this is the RBAC catalog Super
            Admin assigns via roles. Per-organization module on/off switches are
            not invented; design modules stay in the 29-module platform map.
          </p>
        </div>
        <input
          className={fieldCls}
          placeholder="Filter modules"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([module, items]) => (
          <GlassCard key={module} glow="none" className="p-4">
            <h2 className="font-semibold capitalize text-[#1b1a19]">{module}</h2>
            <p className="text-xs text-[#605e5c]">{items.length} permissions</p>
            <ul className="mt-2 space-y-1 text-xs">
              {items.map((p) => (
                <li key={p.code} className="font-mono text-[#323130]">
                  {p.code}
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
