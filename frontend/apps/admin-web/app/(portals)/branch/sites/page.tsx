'use client';

import {
  createSite,
  listBranches,
  listSites,
  type Branch,
  type Site,
} from '@pssms/api-client';
import {
  Modal,
  StatCard,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Building2,
  CheckCircle2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BranchShell } from '../_components/BranchShell';
import { SiteRoster, SitesEmpty } from '../_components/SiteRoster';
import { formatApiError, shortId } from '../_components/shared';

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

export default function BranchSitesPage() {
  const [rows, setRows] = useState<Site[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sites, br] = await Promise.all([listSites(), listBranches()]);
      setRows(sites);
      setBranches(br);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    for (const b of branches) map.set(b.id, b);
    return map;
  }, [branches]);

  const branchLabel = useCallback(
    (branchId: string) => {
      const b = branchMap.get(branchId);
      return b ? `${b.code} — ${b.name}` : shortId(branchId);
    },
    [branchMap],
  );

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      active: 0,
      inactive: 0,
      branches: new Set(rows.map((r) => r.branchId)).size,
    };
    for (const r of rows) {
      if (r.isActive) c.active += 1;
      else c.inactive += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'inactive' && r.isActive) return false;
      if (branchFilter !== 'all' && r.branchId !== branchFilter) return false;
      if (!q) return true;
      const branch = branchLabel(r.branchId).toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        branch.includes(q)
      );
    });
  }, [rows, query, statusFilter, branchFilter, branchLabel]);

  return (
    <BranchShell
      title="Sites"
      description="Customer / facility sites under org branches. Create requires enterprise.manage or operations.manage."
      actions={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className={btnSecondary}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            New site
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total sites"
          value={counts.all}
          hint="Org facility register"
          accent="blue"
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={counts.active}
          hint="Ready for deployments"
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Inactive"
          value={counts.inactive}
          hint="Not currently used"
          accent="slate"
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="Branches covered"
          value={counts.branches}
          hint={`${branches.length} branch${branches.length === 1 ? '' : 'es'} in org`}
          accent="sky"
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">Sites</h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Facility / customer sites · used by deployments, shifts, patrols
          </p>
        </div>
      </div>

      <SiteRoster
        rows={filtered}
        loading={loading}
        branchLabel={branchLabel}
        toolbar={
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
                <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search code, name, branch…"
                  className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
                />
              </label>
              <div className="flex flex-wrap gap-1">
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0078d4] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {f.label}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/80' : 'text-[#a19f9d]'
                        }`}
                      >
                        {counts[f.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {branches.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setBranchFilter('all')}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    branchFilter === 'all'
                      ? 'bg-[#0f172a] text-white shadow-sm'
                      : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                  }`}
                >
                  All branches
                </button>
                {branches.map((b) => {
                  const active = branchFilter === b.id;
                  const n = rows.filter((r) => r.branchId === b.id).length;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBranchFilter(b.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-[#0f172a] text-white shadow-sm'
                          : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd] hover:bg-[#f3f9fd]'
                      }`}
                    >
                      {b.code}
                      <span
                        className={`tabular-nums ${
                          active ? 'text-white/70' : 'text-[#a19f9d]'
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        }
        empty={
          <SitesEmpty
            title={rows.length === 0 ? 'No sites yet' : 'No matches'}
            description={
              rows.length === 0
                ? 'Create a facility site under a branch (needs enterprise.manage or operations.manage).'
                : 'Try another search, status, or branch filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} sites
        </p>
      ) : null}

      {createOpen ? (
        <CreateSiteModal
          branches={branches}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </BranchShell>
  );
}

function CreateSiteModal({
  branches,
  onClose,
  onCreated,
}: {
  branches: Branch[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSite({
        branchId,
        code: code.trim(),
        name: name.trim(),
        address: address.trim() || undefined,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create site" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Branch
          <select
            className={`${inputCls} mt-1`}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Code
          <input
            className={`${inputCls} mt-1`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SITE-..."
            required
          />
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Address (optional)
          <input
            className={`${inputCls} mt-1`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
