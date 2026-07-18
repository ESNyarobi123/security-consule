'use client';

import {
  DEVICE_COMMAND_TYPES,
  getDevice,
  issueDeviceCommand,
  listDeviceCommands,
  updateDevice,
  type DeviceCommand,
  type DeviceCommandType,
  type DeviceDetail,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { Activity, ListChecks, Power, RotateCw, Send, Cpu } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

function fmt(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        getDevice(id),
        listDeviceCommands(id).catch(() => [] as DeviceCommand[]),
      ]);
      setDevice(d);
      setCommands(c);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDisabled() {
    if (!device) return;
    setBusy(true);
    try {
      const next = device.status === 'DISABLED' ? 'OFFLINE' : 'DISABLED';
      await updateDevice(id, { status: next });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={device ? `${device.code} · ${device.name}` : 'Device'}
        description={device ? `${device.type.replace(/_/g, ' ')} · ${device.connection}` : 'Loading…'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/devices" className={btnSecondary}>← Devices</Link>
            <button type="button" onClick={() => void load()} disabled={loading} className={btnSecondary}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {device ? (
              <button type="button" onClick={() => void toggleDisabled()} disabled={busy} className={btnSecondary}>
                <Power className="h-4 w-4" />
                {device.status === 'DISABLED' ? 'Enable' : 'Disable'}
              </button>
            ) : null}
            <button type="button" onClick={() => setCmdOpen(true)} className={btnPrimary} disabled={!device}>
              <Send className="h-4 w-4" />
              Issue command
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={device?.status ?? '…'} hint="Live device state" accent={device && device.status === 'ONLINE' ? 'emerald' : 'amber'} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Events" value={device?.eventCount ?? 0} hint="Ingested (append-only)" accent="blue" icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Pending commands" value={device?.pendingCommands ?? 0} hint="Awaiting device poll" accent="violet" icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Last seen" value={device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : 'never'} hint="Most recent heartbeat" accent="sky" icon={<RotateCw className="h-5 w-5" />} />
      </div>

      <div className="mt-8">
        <SectionTitle>Device details</SectionTitle>
        <div className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Vendor', device?.vendor],
              ['Model', device?.model],
              ['Serial number', device?.serialNumber],
              ['Site ID', device?.siteId],
              ['Gate ID', device?.gateId],
              ['Edge gateway ID', device?.edgeGatewayId],
              ['Created', device ? fmt(device.createdAt) : null],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-0.5 break-all text-sm text-[#1b1a19]">{(value as string) || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle>Command history</SectionTitle>
        <DataTable<DeviceCommand>
          loading={loading}
          keyField="id"
          rows={commands}
          emptyMessage="No commands issued yet."
          columns={[
            { key: 'type', label: 'Type', render: (r) => <span className="font-medium text-[#1b1a19]">{r.type.replace(/_/g, ' ')}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'issuedAt', label: 'Issued', render: (r) => fmt(r.issuedAt) },
            { key: 'acknowledgedAt', label: 'Acknowledged', render: (r) => fmt(r.acknowledgedAt) },
            {
              key: 'result',
              label: 'Result',
              render: (r) =>
                r.result ? (
                  <code className="text-[11px] text-slate-600">{JSON.stringify(r.result).slice(0, 60)}</code>
                ) : (
                  <span className="text-[#a19f9d]">—</span>
                ),
            },
          ]}
        />
      </div>

      {cmdOpen ? (
        <CommandModal
          onClose={() => setCmdOpen(false)}
          onIssued={() => {
            setCmdOpen(false);
            void load();
          }}
          deviceId={id}
        />
      ) : null}
    </>
  );
}

function CommandModal({
  deviceId,
  onClose,
  onIssued,
}: {
  deviceId: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [type, setType] = useState<DeviceCommandType>('PRINT');
  const [payloadText, setPayloadText] = useState('{\n  "title": "GATE PASS"\n}');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let payload: Record<string, unknown> | undefined;
    if (payloadText.trim()) {
      try {
        payload = JSON.parse(payloadText) as Record<string, unknown>;
      } catch {
        setError('Payload must be valid JSON');
        return;
      }
    }
    setSubmitting(true);
    try {
      await issueDeviceCommand(deviceId, { type, payload });
      onIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue command');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Issue command" description="Queued for the device/gateway to poll and execute." onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[#323130]">
          Command type
          <select value={type} onChange={(e) => setType(e.target.value as DeviceCommandType)} className={inputCls}>
            {DEVICE_COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Payload (JSON) <span className="font-normal text-[#605e5c]">(optional)</span>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className={`${inputCls} h-32 font-mono text-xs`}
            spellCheck={false}
          />
        </label>
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Issuing…' : 'Issue command'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
