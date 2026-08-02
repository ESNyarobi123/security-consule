'use client';

import {
  createDeployment,
  endDeployment,
  listContracts,
  listDeployments,
  listGuards,
  listSites,
  type Contract,
  type Deployment,
  type Guard,
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
  CheckCircle2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  DeploymentRoster,
  DeploymentsEmpty,
} from '../_components/DeploymentRoster';
import { formatApiError, shortId } from '../_components/shared';

type StatusFilter = 'all' | 'active' | 'ended';

const BILLABLE = new Set(['APPROVED', 'ACTIVE', 'EXPIRING']);

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'ended', label: 'Ended' },
];

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export default function BranchDeploymentsPage() {
  const [rows, setRows] = useState<Deployment[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, g, s, c] = await Promise.all([
        listDeployments(),
        listGuards(),
        listSites(),
        listContracts(),
      ]);
      setRows(d);
      setGuards(g);
      setSites(s);
      setContracts(c);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const billableContracts = useMemo(
    () =>
      contracts.filter((c) =>
        BILLABLE.has(c.status.trim().toUpperCase().replace(/[\s-]+/g, '_')),
      ),
    [contracts],
  );

  const guardMap = useMemo(() => {
    const map = new Map<string, Guard>();
    for (const g of guards) map.set(g.id, g);
    return map;
  }, [guards]);

  const siteMap = useMemo(() => {
    const map = new Map<string, Site>();
    for (const s of sites) map.set(s.id, s);
    return map;
  }, [sites]);

  const guardLabel = useCallback(
    (id: string) => {
      const g = guardMap.get(id);
      if (!g) return { primary: shortId(id) };
      return {
        primary: g.fullName?.trim() || g.employeeNumber,
        secondary: g.fullName ? g.employeeNumber : undefined,
      };
    },
    [guardMap],
  );

  const siteLabel = useCallback(
    (id: string) => {
      const s = siteMap.get(id);
      if (!s) return { primary: shortId(id) };
      return { primary: s.code, secondary: s.name };
    },
    [siteMap],
  );

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      active: 0,
      ended: 0,
      sites: new Set(rows.filter((r) => norm(r.status) === 'active').map((r) => r.siteId))
        .size,
    };
    for (const r of rows) {
      const s = norm(r.status);
      if (s === 'active') c.active += 1;
      else if (s === 'ended' || s === 'completed') c.ended += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const s = norm(r.status);
      if (statusFilter === 'active' && s !== 'active') return false;
      if (
        statusFilter === 'ended' &&
        s !== 'ended' &&
        s !== 'completed'
      )
        return false;
      if (!q) return true;
      const g = guardLabel(r.guardId);
      const site = siteLabel(r.siteId);
      return (
        g.primary.toLowerCase().includes(q) ||
        (g.secondary ?? '').toLowerCase().includes(q) ||
        site.primary.toLowerCase().includes(q) ||
        (site.secondary ?? '').toLowerCase().includes(q) ||
        (r.contractNumber ?? '').toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, guardLabel, siteLabel]);

  async function onEnd(id: string) {
    setEndingId(id);
    setError(null);
    try {
      await endDeployment(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setEndingId(null);
    }
  }

  return (
    <BranchShell
      title="Deployments"
      description="Assign guards to sites under a billable contract that covers the site. Ending sets ENDED (no payroll side-effects)."
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
            Deploy guard
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total deployments"
          value={counts.all}
          hint="Guard ↔ site ↔ contract"
          accent="blue"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          label="Active"
          value={counts.active}
          hint="Currently deployed"
          accent="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Ended"
          value={counts.ended}
          hint="No payroll side-effects"
          accent="slate"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          label="Sites with active"
          value={counts.sites}
          hint={`${sites.length} site${sites.length === 1 ? '' : 's'} in org`}
          accent="sky"
          icon={<MapPin className="h-5 w-5" />}
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
            <Shield className="h-4 w-4 text-[#0078d4]" />
            <h2 className="text-[15px] font-semibold text-[#1b1a19]">
              Deployments
            </h2>
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0067b8] ring-1 ring-[#c7e0f4]">
              {filtered.length}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#605e5c]">
            Contract must cover site (ContractSite) · End sets ENDED
          </p>
        </div>
      </div>

      <DeploymentRoster
        rows={filtered}
        loading={loading}
        guardLabel={guardLabel}
        siteLabel={siteLabel}
        endingId={endingId}
        onEnd={(id) => void onEnd(id)}
        toolbar={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2 shadow-sm focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]">
              <Search className="h-4 w-4 shrink-0 text-[#8a8886]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guard, site, contract…"
                className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a19f9d]"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
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
        }
        empty={
          <DeploymentsEmpty
            title={rows.length === 0 ? 'No deployments' : 'No matches'}
            description={
              rows.length === 0
                ? 'Deploy an eligible guard under a billable contract that covers the site.'
                : 'Try another search or status filter.'
            }
          />
        }
      />
      {!loading && filtered.length > 0 ? (
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Showing {filtered.length} of {rows.length} deployments
        </p>
      ) : null}

      {createOpen ? (
        <CreateDeploymentModal
          guards={guards}
          sites={sites}
          contracts={billableContracts}
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

function CreateDeploymentModal({
  guards,
  sites,
  contracts,
  onClose,
  onCreated,
}: {
  guards: Guard[];
  sites: Site[];
  contracts: Contract[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const eligible = guards.filter(
    (g) =>
      g.deploymentEligible &&
      (g.status === 'ACTIVE' || g.status === 'AVAILABLE'),
  );
  const [guardId, setGuardId] = useState(eligible[0]?.id ?? guards[0]?.id ?? '');
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '');
  const [siteId, setSiteId] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === contractId),
    [contracts, contractId],
  );

  const contractSites = useMemo(() => {
    if (!selectedContract) return [] as Site[];
    const ids = new Set(
      selectedContract.siteIds?.length
        ? selectedContract.siteIds
        : (selectedContract.sites ?? []).map((s) => s.id),
    );
    if (ids.size === 0) return [];
    return sites.filter((s) => ids.has(s.id));
  }, [selectedContract, sites]);

  useEffect(() => {
    if (contractSites.length === 0) {
      setSiteId('');
      return;
    }
    if (!contractSites.some((s) => s.id === siteId)) {
      setSiteId(contractSites[0]!.id);
    }
  }, [contractSites, siteId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contractId) {
      setError('Select a billable contract');
      return;
    }
    if (!siteId) {
      setError(
        selectedContract
          ? 'Contract has no sites; bind sites on the contract first'
          : 'Select a site',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDeployment({
        guardId,
        siteId,
        contractId,
        startDate: new Date(startDate).toISOString(),
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Deploy guard" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Guard
          <select
            className={`${inputCls} mt-1`}
            value={guardId}
            onChange={(e) => setGuardId(e.target.value)}
            required
          >
            {(eligible.length ? eligible : guards).map((g) => (
              <option key={g.id} value={g.id}>
                {g.fullName
                  ? `${g.fullName} (${g.employeeNumber})`
                  : g.employeeNumber}{' '}
                ({g.status}
                {g.deploymentEligible ? '' : ', not eligible'})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Contract
          <select
            className={`${inputCls} mt-1`}
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            required
          >
            {contracts.length === 0 ? (
              <option value="">No billable contracts</option>
            ) : (
              contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNumber} — {c.title} ({c.status})
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
            disabled={contractSites.length === 0}
          >
            {contractSites.length === 0 ? (
              <option value="">
                {selectedContract
                  ? 'No sites on this contract'
                  : 'Select a contract first'}
              </option>
            ) : (
              contractSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Start date
          <input
            type="date"
            className={`${inputCls} mt-1`}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={saving || !contractId || !siteId}
          >
            {saving ? 'Saving…' : 'Deploy'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
