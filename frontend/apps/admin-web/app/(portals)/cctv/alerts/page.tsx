'use client';

import {
  acknowledgeCctvEvent,
  createIncidentFromCctvEvent,
  getCctvReports,
  listAnprResults,
  listDeviceEvents,
  type AnprResult,
  type CctvReport,
  type DeviceEvent,
} from '@pssms/api-client';
import { DataTable, StatusBadge, btnSecondary } from '@pssms/ui';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatApiError, formatWhen } from '../_components/shared';

export default function CctvAlertsPage() {
  const [pack, setPack] = useState<CctvReport | null>(null);
  const [alerts, setAlerts] = useState<DeviceEvent[]>([]);
  const [anpr, setAnpr] = useState<AnprResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reports, events, plates] = await Promise.all([
        getCctvReports(),
        listDeviceEvents({ type: 'CCTV_EVENT' }),
        listAnprResults(),
      ]);
      setPack(reports);
      setAlerts(events);
      setAnpr(plates.slice(0, 40));
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAlerts = useMemo(
    () => alerts.filter((a) => ['RECEIVED', 'FAILED'].includes(a.status)),
    [alerts],
  );

  async function ack(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      await acknowledgeCctvEvent(id);
      setNotice('Alert acknowledged (audited).');
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function recordIncident(id: string) {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await createIncidentFromCctvEvent(id);
      setNotice(`Incident ${res.incident.incidentNumber} recorded (28-A).`);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#605e5c]">
          Open AI alerts: <strong>{pack?.openAiAlerts ?? '—'}</strong> · ANPR
          today: <strong>{pack?.anprToday ?? '—'}</strong>. Decide stays Parking
          / Ops — CCTV operators acknowledge metadata only.
        </p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      <h2 className="mb-2 text-sm font-semibold text-[#1b1a19]">AI inbox</h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={openAlerts}
        emptyMessage="No open CCTV_EVENT alerts"
        columns={[
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'type',
            label: 'Type',
          },
          {
            key: 'receivedAt',
            label: 'Received',
            render: (r) => formatWhen(r.receivedAt),
          },
          {
            key: 'id',
            label: '',
            render: (r) => (
              <span className="flex gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busyId === r.id}
                  onClick={() => void ack(r.id)}
                >
                  Ack
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busyId === r.id}
                  onClick={() => void recordIncident(r.id)}
                >
                  Incident
                </button>
              </span>
            ),
          },
        ]}
      />
      <h2 className="mb-2 mt-6 text-sm font-semibold text-[#1b1a19]">
        ANPR (recent)
      </h2>
      <DataTable
        loading={loading}
        keyField="id"
        rows={anpr}
        emptyMessage="No ANPR results"
        columns={[
          { key: 'plateNumber', label: 'Plate' },
          {
            key: 'decision',
            label: 'Decision',
            render: (r) => <StatusBadge status={r.decision} />,
          },
          {
            key: 'capturedAt',
            label: 'Captured',
            render: (r) => formatWhen(r.capturedAt),
          },
        ]}
      />
    </div>
  );
}
