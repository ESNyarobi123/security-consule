'use client';

import {
  listEssEquipment,
  returnEssEquipment,
  type EssEquipment,
} from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { Package, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

function equipmentStatus(r: EssEquipment) {
  if (r.status === 'RETURN_REQUESTED' || r.returnRequestedAt) {
    return 'RETURN_REQUESTED';
  }
  return r.status || 'ASSIGNED';
}

export default function EssEquipmentPage() {
  const [rows, setRows] = useState<EssEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssEquipment());
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onRequestReturn(assignmentId: string, label: string) {
    if (
      !window.confirm(
        `Request return of “${label}”? A storekeeper must confirm receipt.`,
      )
    ) {
      return;
    }
    setBusyId(assignmentId);
    setError(null);
    try {
      await returnEssEquipment(assignmentId);
      await refresh();
    } catch (err) {
      if (isEssProfileMissing(err)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <EssShell
      title="Equipment"
      description="Assets assigned to you. Request return when you hand them to the storekeeper."
      actions={
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
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {missing ? (
        <PanelEmpty
          icon={<Package className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Package className="h-4 w-4" />}
                title="No equipment assigned"
                description="Uniforms, radios, and other assets appear here when assigned."
              />
            </div>
          ) : (
            <DataTable<EssEquipment>
              loading={loading}
              keyField="assignmentId"
              rows={rows}
              emptyMessage="No equipment"
              columns={[
                {
                  key: 'assetTag',
                  label: 'Tag',
                  render: (r) => (
                    <span className="font-mono text-sm">{r.assetTag}</span>
                  ),
                },
                { key: 'name', label: 'Name' },
                {
                  key: 'category',
                  label: 'Category',
                  render: (r) => r.category ?? '—',
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <StatusBadge status={equipmentStatus(r)} />
                  ),
                },
                {
                  key: 'assignedAt',
                  label: 'Assigned',
                  render: (r) => formatDate(r.assignedAt),
                },
                {
                  key: 'notes',
                  label: 'Notes',
                  render: (r) => (
                    <span
                      className="max-w-[160px] truncate text-xs text-[#605e5c]"
                      title={r.notes ?? undefined}
                    >
                      {r.notes ?? '—'}
                    </span>
                  ),
                },
                {
                  key: 'assignmentId',
                  label: '',
                  render: (r) => {
                    const pending = equipmentStatus(r) === 'RETURN_REQUESTED';
                    if (pending) {
                      return (
                        <span className="text-[11px] text-[#a19f9d]">
                          Awaiting storekeeper
                        </span>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          void onRequestReturn(
                            r.assignmentId,
                            r.name || r.assetTag || 'equipment',
                          )
                        }
                        disabled={busyId === r.assignmentId}
                        className="rounded-md border border-[#8a8886] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] transition hover:bg-[#f3f2f1] disabled:opacity-60"
                      >
                        {busyId === r.assignmentId
                          ? 'Requesting…'
                          : 'Request return'}
                      </button>
                    );
                  },
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
