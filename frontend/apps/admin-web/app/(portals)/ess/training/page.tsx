'use client';

import { listEssTraining, type EssTrainingRow } from '@pssms/api-client';
import { DataTable, GlassCard, StatusBadge, btnSecondary } from '@pssms/ui';
import { GraduationCap, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EssShell } from '../_components/EssShell';
import {
  PanelEmpty,
  formatDate,
  isEssProfileMissing,
} from '../_components/shared';

export default function EssTrainingPage() {
  const [rows, setRows] = useState<EssTrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      setRows(await listEssTraining());
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

  return (
    <EssShell
      title="Training"
      description="Courses HR recorded against your employee file. You cannot add or edit records here."
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
          icon={<GraduationCap className="h-4 w-4" />}
          title="Ask HR to link your account"
          description="No employee profile is linked to this login."
        />
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {rows.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<GraduationCap className="h-4 w-4" />}
                title="No training records"
                description="When HR logs a course against your file, it appears here."
              />
            </div>
          ) : (
            <DataTable
              loading={loading}
              keyField="id"
              rows={rows}
              emptyMessage="No training"
              columns={[
                { key: 'title', label: 'Course' },
                {
                  key: 'provider',
                  label: 'Provider',
                  render: (r) => r.provider ?? '—',
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
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
            />
          )}
        </GlassCard>
      )}
    </EssShell>
  );
}
