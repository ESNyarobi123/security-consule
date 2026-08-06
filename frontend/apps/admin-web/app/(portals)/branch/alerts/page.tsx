'use client';

import {
  acknowledgeFieldAlert,
  escalateFieldAlert,
  listFieldAlerts,
  listGuards,
  listSites,
  type FieldAlert,
  type Guard,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
} from '@pssms/ui';
import { Bell, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import {
  formatApiError,
  formatDateTime,
  shortId,
} from '../_components/shared';

export default function BranchAlertsPage() {
  const [rows, setRows] = useState<FieldAlert[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [showAcked, setShowAcked] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alerts, g, s] = await Promise.all([
        listFieldAlerts(
          showAcked ? undefined : { acknowledged: false },
        ),
        listGuards(),
        listSites(),
      ]);
      setRows(alerts);
      setGuards(g);
      setSites(s);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showAcked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guardLabel = (id?: string | null) => {
    if (!id) return '—';
    const g = guards.find((x) => x.id === id);
    return g ? g.employeeNumber : shortId(id);
  };
  const siteLabel = (id: string) => {
    const s = sites.find((x) => x.id === id);
    return s ? s.code : shortId(id);
  };

  async function onEscalate(id: string) {
    setEscalatingId(id);
    setError(null);
    try {
      await escalateFieldAlert(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setEscalatingId(null);
    }
  }

  async function onAck(id: string) {
    setAckingId(id);
    setError(null);
    try {
      await acknowledgeFieldAlert(id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setAckingId(null);
    }
  }

  return (
    <BranchShell
      title="Field alerts"
      description="Alertness, patrol, and visitor gate-deny FieldAlerts (VISITOR_GATE_DENIED · Module 12-A). AL1 ladder: SUPERVISOR → FIELD → BOM → CONTROL. Escalate or acknowledge (operations.manage or attendance.manage)."
      actions={
        <>
          <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            <input
              type="checkbox"
              checked={showAcked}
              onChange={(e) => setShowAcked(e.target.checked)}
            />
            Include acknowledged
          </label>
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
            <Bell className="h-5 w-5 text-[#a19f9d]" />
            <p>{showAcked ? 'No field alerts' : 'No open field alerts'}</p>
          </div>
        ) : (
          <DataTable<FieldAlert>
            loading={loading}
            keyField="id"
            rows={rows}
            emptyMessage="No alerts"
            columns={[
              {
                key: 'severity',
                label: 'Severity',
                render: (r) => <StatusBadge status={r.severity} />,
              },
              { key: 'alertType', label: 'Type' },
              {
                key: 'siteId',
                label: 'Site',
                render: (r) => siteLabel(r.siteId),
              },
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
                key: 'message',
                label: 'Message',
                render: (r) => (
                  <span className="line-clamp-2 max-w-xs text-xs">
                    {r.message}
                  </span>
                ),
              },
              {
                key: 'escalationStage',
                label: 'Stage',
                render: (r) => (
                  <StatusBadge status={r.escalationStage ?? 'SUPERVISOR'} />
                ),
              },
              {
                key: 'createdAt',
                label: 'When',
                render: (r) => formatDateTime(r.createdAt),
              },
              {
                key: 'acknowledged',
                label: 'Actions',
                render: (r) =>
                  r.acknowledged ? (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Acked
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.escalationStage !== 'CONTROL' ? (
                        <button
                          type="button"
                          className={btnSecondary}
                          disabled={escalatingId === r.id}
                          onClick={() => void onEscalate(r.id)}
                        >
                          {escalatingId === r.id ? '…' : 'Escalate'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={ackingId === r.id}
                        onClick={() => void onAck(r.id)}
                      >
                        {ackingId === r.id ? '…' : 'Acknowledge'}
                      </button>
                    </div>
                  ),
              },
            ]}
          />
        )}
      </GlassCard>
    </BranchShell>
  );
}
