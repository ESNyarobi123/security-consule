'use client';

import {
  createRole,
  listPermissions,
  listRoles,
  setRolePermissions,
  type AdminRole,
  type PermissionCatalogItem,
} from '@pssms/api-client';
import { GlassCard, btnPrimary, btnSecondary } from '@pssms/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

export default function SuperAdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(r);
      setPermissions(p);
      setSelectedId((prev) => prev ?? r[0]?.id ?? null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    setDraft(selected?.permissions ?? []);
  }, [selectedId, selected?.permissions]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const p of permissions) {
      if (
        q &&
        !p.code.toLowerCase().includes(q) &&
        !p.name.toLowerCase().includes(q) &&
        !p.module.toLowerCase().includes(q)
      ) {
        continue;
      }
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions, query]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createRole({
        code: code.trim().toUpperCase().replace(/\s+/g, '_'),
        name: name.trim(),
        description: description.trim() || undefined,
        permissionCodes: [],
      });
      setCode('');
      setName('');
      setDescription('');
      await refresh();
      setSelectedId(created.id);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePermissions() {
    if (!selected || selected.isSystem) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await setRolePermissions(selected.id, draft);
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggle(codeValue: string) {
    setDraft((prev) =>
      prev.includes(codeValue)
        ? prev.filter((c) => c !== codeValue)
        : [...prev, codeValue],
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">Roles & permissions</h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Create custom roles and replace their permission set. System roles are
          locked. §4 A6: non-GM/Super Admin cannot grant users.manage.
        </p>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <GlassCard glow="none" className="p-3">
          <form onSubmit={(e) => void onCreate(e)} className="space-y-2">
            <input
              className={fieldCls + ' w-full'}
              placeholder="ROLE_CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <input
              className={fieldCls + ' w-full'}
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={fieldCls + ' w-full'}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit" className={btnPrimary} disabled={busy}>
              Create custom role
            </button>
          </form>
          <ul className="mt-4 max-h-[480px] space-y-1 overflow-y-auto">
            {loading ? (
              <li className="text-sm text-[#605e5c]">Loading…</li>
            ) : (
              roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(role.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                      role.id === selectedId
                        ? 'bg-[#eff6fc] text-[#0078d4]'
                        : 'hover:bg-[#faf9f8]'
                    }`}
                  >
                    <span className="font-medium">{role.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-[#605e5c]">
                      {role.code}
                    </span>
                    {role.isSystem ? (
                      <span className="ml-2 text-[10px] uppercase text-amber-700">
                        system
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </GlassCard>

        <GlassCard glow="none" className="p-4">
          {!selected ? (
            <p className="text-sm text-[#605e5c]">Select a role.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-[#1b1a19]">{selected.name}</h2>
                  <p className="text-xs text-[#605e5c]">
                    {draft.length} permissions
                    {selected.isSystem ? ' · locked' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={fieldCls}
                    placeholder="Filter permissions"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy || selected.isSystem}
                    onClick={() => void onSavePermissions()}
                  >
                    Save permissions
                  </button>
                </div>
              </div>
              <div className="max-h-[560px] space-y-4 overflow-y-auto">
                {grouped.map(([module, items]) => (
                  <section key={module}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                      {module}
                    </h3>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {items.map((p) => (
                        <li key={p.code}>
                          <label className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-[#faf9f8]">
                            <input
                              type="checkbox"
                              disabled={selected.isSystem}
                              checked={draft.includes(p.code)}
                              onChange={() => toggle(p.code)}
                            />
                            <span>
                              <span className="font-mono text-xs">{p.code}</span>
                              <span className="block text-xs text-[#605e5c]">
                                {p.name}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
