'use client';

import {
  addBlacklist,
  deactivateBlacklist,
  listBlacklist,
  type ParkingBlacklistEntry,
} from '@pssms/api-client';
import { DataTable, PageHeader, StatusBadge } from '@pssms/ui';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type BlacklistRow = {
  id: string;
  plateNumber: string;
  reason: string;
  isActive: string;
  createdAt: string;
};

function toRow(b: ParkingBlacklistEntry): BlacklistRow {
  return {
    id: b.id,
    plateNumber: b.plateNumber,
    reason: b.reason,
    isActive: b.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: b.createdAt,
  };
}

export default function BlacklistPage() {
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listBlacklist();
      setRows(
        list
          .filter((b) => b.isActive)
          .map(toRow)
          .concat(list.filter((b) => !b.isActive).map(toRow)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blacklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addBlacklist({ plateNumber: plateNumber.trim(), reason: reason.trim() });
      setPlateNumber('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deactivateBlacklist(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Blacklist"
        description="Blocked plates for gate / ANPR decisions"
      />
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onAdd}
        className="mb-8 grid max-w-xl gap-3 rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="block text-sm text-slate-600">
          Plate
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            required
            minLength={3}
          />
        </label>
        <label className="block text-sm text-slate-600">
          Reason
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#8a8886] bg-white px-3 py-2 text-[#1b1a19] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]"
            required
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-[#0078d4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#106ebe] disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      <DataTable
        loading={loading}
        keyField="id"
        rows={rows.filter((r) => r.isActive === 'ACTIVE')}
        emptyMessage="No active blacklist entries"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          { key: 'reason', label: 'Reason' },
          {
            key: 'isActive',
            label: 'Status',
            render: (row) => <StatusBadge status={row.isActive} />,
          },
          { key: 'createdAt', label: 'Created' },
          {
            key: 'id',
            label: 'Actions',
            render: (row) => (
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void onDeactivate(row.id)}
                className="rounded-md border border-[#8a8886] px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] disabled:opacity-60"
              >
                {busyId === row.id ? '…' : 'Deactivate'}
              </button>
            ),
          },
        ]}
      />
    </>
  );
}
