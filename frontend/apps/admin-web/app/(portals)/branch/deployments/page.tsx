'use client';

import {
  createDeployment,
  endDeployment,
  listDeployments,
  listGuards,
  listSites,
  type Deployment,
  type Guard,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Plus, RefreshCw, Shield } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  formatApiError,
  formatDate,
  shortId,
} from '../_components/shared';

export default function BranchDeploymentsPage() {
  const [rows, setRows] = useState<Deployment[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, g, s] = await Promise.all([
        listDeployments(),
        listGuards(),
        listSites(),
      ]);
      setRows(d);
      setGuards(g);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guardLabel = (id: string) => {
    const g = guards.find((x) => x.id === id);
    return g ? g.employeeNumber : shortId(id);
  };
  const siteLabel = (id: string) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.code}` : shortId(id);
  };

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
      description="Assign guards to sites. Ending a deployment sets status ENDED (no payroll side-effects)."
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
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <Shield className="h-5 w-5 text-[#a19f9d]" />
            <p>No deployments</p>
          </div>
        ) : (
          <DataTable<Deployment>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No deployments"
            columns={[
              {
                key: 'guardId',
                label: 'Guard',
                render: (r) => (
                  <span className="font-mono text-sm">
                    {guardLabel(r.guardId)}
                  </span>
                ),
              },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r.siteId),
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'startDate',
                label: 'Start',
                render: (r) => formatDate(r.startDate),
              },
              {
                key: 'endDate',
                label: 'End',
                render: (r) => formatDate(r.endDate),
              },
              {
                key: 'id',
                label: '',
                render: (r) =>
                  r.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={endingId === r.id}
                      onClick={() => void onEnd(r.id)}
                    >
                      {endingId === r.id ? 'Ending…' : 'End'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">—</span>
                  ),
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateDeploymentModal
          guards={guards}
          sites={sites}
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
  onClose,
  onCreated,
}: {
  guards: Guard[];
  sites: Site[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const eligible = guards.filter(
    (g) => g.deploymentEligible && g.status === 'ACTIVE',
  );
  const [guardId, setGuardId] = useState(eligible[0]?.id ?? guards[0]?.id ?? '');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDeployment({
        guardId,
        siteId,
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
                {g.employeeNumber} ({g.status}
                {g.deploymentEligible ? '' : ', not eligible'})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
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
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Deploy'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
