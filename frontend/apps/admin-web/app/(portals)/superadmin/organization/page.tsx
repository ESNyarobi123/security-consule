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

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
      Inactive
    </span>
  );
}

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

  const activeBranches = useMemo(
    () => branches.filter((b) => b.isActive),
    [branches],
  );
  const inactiveBranches = useMemo(
    () => branches.filter((b) => !b.isActive),
    [branches],
  );
  const sortedBranches = useMemo(
    () => [...activeBranches, ...inactiveBranches],
    [activeBranches, inactiveBranches],
  );

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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Branches</h2>
            <p className="text-[11px] text-[#605e5c]">
              {activeBranches.length} active · {inactiveBranches.length} inactive
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#605e5c]">
            Deactivate does <span className="font-semibold">not delete</span> —
            the branch stays here with an Inactive badge. Inactive branches are
            hidden from Customer → Add site. Keep at least one Active branch.
          </p>
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
          {activeBranches.length === 0 && !loading ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No active branches — Customer Add site will be empty until you
              Reactivate one below.
            </p>
          ) : null}
          <ul className="mt-4 divide-y divide-[#edebe9] text-sm">
            {sortedBranches.map((b) => (
              <li
                key={b.id}
                className={`flex items-center justify-between gap-2 py-2 ${
                  b.isActive ? '' : 'opacity-70'
                }`}
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono text-xs ${
                        b.isActive ? '' : 'line-through decoration-slate-400'
                      }`}
                    >
                      {b.code}
                    </span>
                    <span className="font-medium">{b.name}</span>
                    <StatusBadge active={b.isActive} />
                  </span>
                  {b.region ? (
                    <span className="mt-0.5 block text-xs text-[#605e5c]">
                      {b.region}
                    </span>
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
                ) : null}
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
                {activeBranches.map((b) => (
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
                className={`flex items-center justify-between gap-2 py-2 ${
                  d.isActive ? '' : 'opacity-70'
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono text-xs ${
                      d.isActive ? '' : 'line-through decoration-slate-400'
                    }`}
                  >
                    {d.code}
                  </span>
                  <span className="font-medium">{d.name}</span>
                  <StatusBadge active={d.isActive} />
                </span>
                {canMutate ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() =>
                      void updateDepartment(d.id, {
                        isActive: !d.isActive,
                      }).then(refresh, (err) => setError(formatApiError(err)))
                    }
                  >
                    {d.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
