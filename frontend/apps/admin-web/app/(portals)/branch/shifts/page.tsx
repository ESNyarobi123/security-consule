'use client';

import {
  createShift,
  listGuards,
  listShifts,
  listSites,
  type Guard,
  type Shift,
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
import { Plus, RefreshCw, Timer } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  formatApiError,
  formatDateTime,
  shortId,
} from '../_components/shared';

export default function BranchShiftsPage() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sh, g, s] = await Promise.all([
        listShifts(),
        listGuards(),
        listSites(),
      ]);
      setRows(sh);
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

  const siteLabel = (id: string) => {
    const s = sites.find((x) => x.id === id);
    return s ? s.code : shortId(id);
  };

  return (
    <BranchShell
      title="Shifts"
      description="Schedule shifts with guard assignments for a site."
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
            New shift
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
            <Timer className="h-5 w-5 text-[#a19f9d]" />
            <p>No shifts</p>
          </div>
        ) : (
          <DataTable<Shift>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No shifts"
            columns={[
              { key: 'name', label: 'Name' },
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
                key: 'startAt',
                label: 'Start',
                render: (r) => formatDateTime(r.startAt),
              },
              {
                key: 'endAt',
                label: 'End',
                render: (r) => formatDateTime(r.endAt),
              },
            ]}
          />
        )}
      </GlassCard>

      {createOpen ? (
        <CreateShiftModal
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

function CreateShiftModal({
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
  const now = new Date();
  const later = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [name, setName] = useState('Day Shift');
  const [startAt, setStartAt] = useState(toLocal(now));
  const [endAt, setEndAt] = useState(toLocal(later));
  const [guardIds, setGuardIds] = useState<string[]>(
    guards[0]?.id ? [guards[0].id] : [],
  );
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGuard(id: string) {
    setGuardIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guardIds.length) {
      setError('Select at least one guard');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createShift({
        siteId,
        name: name.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        guardIds,
        instructions: instructions.trim() || undefined,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create shift" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
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
          Name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Start
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            End
            <input
              type="datetime-local"
              className={`${inputCls} mt-1`}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-[#605e5c]">Guards</legend>
          <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-[#e1dfdd] p-2">
            {guards.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-2 text-xs text-[#323130]"
              >
                <input
                  type="checkbox"
                  checked={guardIds.includes(g.id)}
                  onChange={() => toggleGuard(g.id)}
                />
                <span className="font-mono">{g.employeeNumber}</span>
                <span className="text-[#a19f9d]">({g.status})</span>
              </label>
            ))}
            {guards.length === 0 ? (
              <p className="text-xs text-[#a19f9d]">No guards available</p>
            ) : null}
          </div>
        </fieldset>
        <label className="block text-xs font-medium text-[#605e5c]">
          Instructions (optional)
          <textarea
            className={`${inputCls} mt-1 min-h-[64px]`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
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
