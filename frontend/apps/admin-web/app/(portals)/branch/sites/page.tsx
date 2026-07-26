'use client';

import {
  createSite,
  listBranches,
  listSites,
  type Branch,
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
import { MapPin, Plus, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, shortId } from '../_components/shared';

export default function BranchSitesPage() {
  const [rows, setRows] = useState<Site[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  const branchLabel = (branchId: string) => {
    const b = branches.find((x) => x.id === branchId);
    return b ? `${b.code} — ${b.name}` : shortId(branchId);
  };

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
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <GlassCard className="!p-0 overflow-hidden">
        {rows.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
            <MapPin className="h-5 w-5 text-[#a19f9d]" />
            <p>No sites yet</p>
          </div>
        ) : (
          <DataTable<Site>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No sites"
            columns={[
              {
                key: 'code',
                label: 'Code',
                render: (r) => (
                  <span className="font-mono text-sm">{r.code}</span>
                ),
              },
              { key: 'name', label: 'Name' },
              {
                key: 'branchId',
                label: 'Branch',
                render: (r) => (
                  <span className="text-xs text-[#605e5c]">
                    {branchLabel(r.branchId)}
                  </span>
                ),
              },
              {
                key: 'isActive',
                label: 'Status',
                render: (r) => (
                  <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                ),
              },
            ]}
          />
        )}
      </GlassCard>

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
