'use client';

import {
  createBranch,
  createDepartment,
  getOrganization,
  listBranches,
  listDepartments,
  updateBranch,
  updateDepartment,
  type Branch,
  type Department,
  type OrganizationProfile,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { GlassCard, btnPrimary, btnSecondary } from '@pssms/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldCls, formatApiError } from '../_components/shared';

export default function SuperAdminOrganizationPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canMutate = can(session, 'enterprise.manage');
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bCode, setBCode] = useState('');
  const [bName, setBName] = useState('');
  const [bRegion, setBRegion] = useState('');
  const [dCode, setDCode] = useState('');
  const [dName, setDName] = useState('');
  const [dBranchId, setDBranchId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, b, d] = await Promise.all([
        getOrganization(),
        listBranches(),
        listDepartments(),
      ]);
      setOrg(o);
      setBranches(b);
      setDepartments(d);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createBranch({
        code: bCode.trim().toUpperCase(),
        name: bName.trim(),
        region: bRegion.trim() || undefined,
      });
      setBCode('');
      setBName('');
      setBRegion('');
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateDepartment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createDepartment({
        code: dCode.trim().toUpperCase(),
        name: dName.trim(),
        branchId: dBranchId || undefined,
      });
      setDCode('');
      setDName('');
      setDBranchId('');
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1b1a19]">
          Organization, branches & departments
        </h1>
        <p className="mt-1 text-sm text-[#605e5c]">
          Company profile plus enterprise master data. Create/deactivate needs
          enterprise.manage (ICT / Super Admin). Sites stay under Branch Ops.
        </p>
      </div>
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <GlassCard glow="none" className="p-4">
        <h2 className="text-sm font-semibold">Company</h2>
        {loading && !org ? (
          <p className="mt-2 text-sm text-[#605e5c]">Loading…</p>
        ) : org ? (
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[#605e5c]">Name</dt>
              <dd className="font-medium">{org.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#605e5c]">Code</dt>
              <dd className="font-mono">{org.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#605e5c]">TIN</dt>
              <dd>{org.tin || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#605e5c]">Status</dt>
              <dd>{org.isActive ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[#605e5c]">No organization profile.</p>
        )}
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard glow="none" className="p-4">
          <h2 className="text-sm font-semibold">Branches</h2>
          {canMutate ? (
            <form
              onSubmit={(e) => void onCreateBranch(e)}
              className="mt-3 grid gap-2 sm:grid-cols-3"
            >
              <input
                className={fieldCls}
                placeholder="Code"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                required
              />
              <input
                className={fieldCls}
                placeholder="Name"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                required
              />
              <input
                className={fieldCls}
                placeholder="Region"
                value={bRegion}
                onChange={(e) => setBRegion(e.target.value)}
              />
              <button type="submit" className={btnPrimary} disabled={busy}>
                Add branch
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-[#605e5c]">
              View only — enterprise.manage required to create.
            </p>
          )}
          <ul className="mt-4 divide-y divide-[#edebe9] text-sm">
            {branches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-mono text-xs">{b.code}</span>{' '}
                  <span className="font-medium">{b.name}</span>
                  {b.region ? (
                    <span className="text-xs text-[#605e5c]"> · {b.region}</span>
                  ) : null}
                </span>
                {canMutate ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() =>
                      void updateBranch(b.id, { isActive: !b.isActive }).then(
                        refresh,
                        (err) => setError(formatApiError(err)),
                      )
                    }
                  >
                    {b.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                ) : (
                  <span className="text-xs text-[#605e5c]">
                    {b.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard glow="none" className="p-4">
          <h2 className="text-sm font-semibold">Departments</h2>
          {canMutate ? (
            <form
              onSubmit={(e) => void onCreateDepartment(e)}
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              <input
                className={fieldCls}
                placeholder="Code"
                value={dCode}
                onChange={(e) => setDCode(e.target.value)}
                required
              />
              <input
                className={fieldCls}
                placeholder="Name"
                value={dName}
                onChange={(e) => setDName(e.target.value)}
                required
              />
              <select
                className={fieldCls}
                value={dBranchId}
                onChange={(e) => setDBranchId(e.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
              <button type="submit" className={btnPrimary} disabled={busy}>
                Add department
              </button>
            </form>
          ) : null}
          <ul className="mt-4 divide-y divide-[#edebe9] text-sm">
            {departments.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-mono text-xs">{d.code}</span>{' '}
                  <span className="font-medium">{d.name}</span>
                </span>
                {canMutate ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() =>
                      void updateDepartment(d.id, { isActive: !d.isActive }).then(
                        refresh,
                        (err) => setError(formatApiError(err)),
                      )
                    }
                  >
                    {d.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                ) : (
                  <span className="text-xs text-[#605e5c]">
                    {d.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
