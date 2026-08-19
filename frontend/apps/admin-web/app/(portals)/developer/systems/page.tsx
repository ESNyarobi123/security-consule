'use client';

import {
  getDeveloperSystems,
  type DeveloperSystemsMonitor,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import { Camera, Fingerprint, Radio, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';

function CountCard({
  label,
  counts,
}: {
  label: string;
  counts: { total: number; online: number };
}) {
  return (
    <GlassCard className="!p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#605e5c]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[#1b1a19]">
        {counts.online}
        <span className="ml-1 text-sm font-normal text-[#605e5c]">
          / {counts.total} online
        </span>
      </p>
    </GlassCard>
  );
}

export default function DeveloperSystemsPage() {
  const [data, setData] = useState<DeveloperSystemsMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDeveloperSystems());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const types = data ? Object.entries(data.byType).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <DeveloperShell
      title="Device systems"
      description="Biometric, CCTV, RFID, and ANPR counts from the device registry and event metadata. Video stays on the NVR. Register devices on /devices."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ANPR today"
          value={loading ? '…' : (data?.anprToday ?? 0)}
          hint="Captured in 24h"
          icon={<Camera className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Open CCTV events"
          value={loading ? '…' : (data?.openCctvEvents ?? 0)}
          hint="RECEIVED / FAILED"
          icon={<Camera className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="MQTT-connected devices"
          value={loading ? '…' : (data?.mqttConnectionDevices ?? 0)}
          hint="Connection type on registry"
          icon={<Radio className="h-4 w-4" />}
          accent="slate"
        />
        <StatCard
          label="Nest MQTT client"
          value={data?.nestMqttClient ? 'on' : 'off'}
          hint="Not coded yet"
          icon={<Fingerprint className="h-4 w-4" />}
          accent="slate"
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Biometric" counts={data?.biometric ?? { total: 0, online: 0 }} />
        <CountCard label="RFID / cards" counts={data?.rfid ?? { total: 0, online: 0 }} />
        <CountCard label="CCTV cameras" counts={data?.cctv ?? { total: 0, online: 0 }} />
        <CountCard label="QR / barcode" counts={data?.scanners ?? { total: 0, online: 0 }} />
      </div>

      {types.length > 0 ? (
        <div className="mb-4 overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#faf9f8] text-[#605e5c]">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Online</th>
              </tr>
            </thead>
            <tbody>
              {types.map(([type, counts]) => (
                <tr key={type} className="border-t border-[#edebe9]">
                  <td className="px-3 py-2 font-mono text-[#1b1a19]">{type}</td>
                  <td className="px-3 py-2">{counts.total}</td>
                  <td className="px-3 py-2">{counts.online}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mb-2 text-xs text-[#605e5c]">
        <Link href="/devices" className="font-medium text-[#0067b8] hover:text-[#004578]">
          Device registry →
        </Link>
        <span className="text-[#a19f9d]"> (CCTV wall needs cctv.manage — not on DEVELOPER)</span>
      </p>
      {(data?.notes ?? []).map((n) => (
        <p key={n} className="text-xs text-[#605e5c]">
          {n}
        </p>
      ))}
    </DeveloperShell>
  );
}
