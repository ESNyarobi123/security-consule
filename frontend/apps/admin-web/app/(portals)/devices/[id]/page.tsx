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
  AZURE,
  DataTable,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Activity,
  ExternalLink,
  ListChecks,
  Power,
  RotateCw,
  Send,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  KpiCard,
  WALL,
  deviceTypeMeta,
  formatWhen,
  isDeviceOnline,
  relativeTime,
  statusTone,
} from '../_components/shared';

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

  const online = device ? isDeviceOnline(device.status) : false;
  const meta = device ? deviceTypeMeta(device.type) : null;
  const Icon = meta?.Icon ?? Cpu;
  const tone = device ? statusTone(device.status) : null;
  const isCctv = device?.type === 'CCTV_CAMERA';

  return (
    <div className="pb-6">
      <section
        className="relative mb-5 overflow-hidden rounded-2xl shadow-md"
        style={{
          background: `linear-gradient(125deg, #071525 0%, ${AZURE.navy} 42%, #0b4f7a 78%, #0e7490 100%)`,
          border: '1px solid rgba(56, 189, 248, 0.28)',
        }}
      >
        <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-2 ring-white/15"
                style={{
                  background: online
                    ? 'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)'
                    : 'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
                }}
              >
                <Icon className="h-6 w-6" />
                {online ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                ) : null}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-300/30">
                    Field device
                  </span>
                  {tone ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
                    >
                      {tone.label}
                    </span>
                  ) : null}
                  {meta ? (
                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                      {meta.short}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  {device ? `${device.code} · ${device.name}` : 'Device'}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  {device
                    ? `${meta?.label ?? device.type} · ${device.connection} · last seen ${relativeTime(device.lastSeenAt)}`
                    : 'Loading device registry detail…'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/devices"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                ← Devices
              </Link>
              {isCctv ? (
                <Link
                  href="/cctv"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  <ExternalLink className="h-4 w-4" />
                  CCTV wall
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-60"
              >
                <RotateCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
              {device ? (
                <button
                  type="button"
                  onClick={() => void toggleDisabled()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-60"
                >
                  <Power className="h-4 w-4" />
                  {device.status === 'DISABLED' ? 'Enable' : 'Disable'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                disabled={!device}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Issue command
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Status"
              value={device?.status ?? '…'}
              hint="Live device state"
              tone={online ? 'emerald' : 'amber'}
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Events"
              value={loading ? '…' : (device?.eventCount ?? 0)}
              hint="Ingested (append-only)"
              tone="sky"
              icon={<Cpu className="h-4 w-4" />}
            />
            <KpiCard
              label="Pending commands"
              value={loading ? '…' : (device?.pendingCommands ?? 0)}
              hint="Awaiting device poll"
              tone="teal"
              icon={<ListChecks className="h-4 w-4" />}
            />
            <KpiCard
              label="Last seen"
              value={
                device?.lastSeenAt
                  ? new Date(device.lastSeenAt).toLocaleTimeString()
                  : 'never'
              }
              hint="Most recent heartbeat"
              tone="slate"
              icon={<RotateCw className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      <section
        className="mb-5 overflow-hidden rounded-xl shadow-lg"
        style={{
          background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
          border: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: WALL.muted }}
          >
            Device details
          </p>
          <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
            HIGHLINK · CONTROL ROOM
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Vendor', device?.vendor],
              ['Model', device?.model],
              ['Serial number', device?.serialNumber],
              ['Site ID', device?.siteId],
              ['Gate ID', device?.gateId],
              ['Edge gateway ID', device?.edgeGatewayId],
              ['Created', device ? formatWhen(device.createdAt) : null],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: WALL.muted }}
                >
                  {label}
                </dt>
                <dd className="mt-0.5 break-all text-sm text-slate-100">
                  {(value as string) || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl shadow-lg"
        style={{
          background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
          border: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: WALL.muted }}
          >
            Command history
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <div className="overflow-hidden rounded-lg bg-white/95 shadow-inner">
            <DataTable<DeviceCommand>
              loading={loading}
              keyField="id"
              rows={commands}
              emptyMessage="No commands issued yet."
              columns={[
                {
                  key: 'type',
                  label: 'Type',
                  render: (r) => (
                    <span className="font-medium text-[#1b1a19]">
                      {r.type.replace(/_/g, ' ')}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => <StatusBadge status={r.status} />,
                },
                {
                  key: 'issuedAt',
                  label: 'Issued',
                  render: (r) => formatWhen(r.issuedAt),
                },
                {
                  key: 'acknowledgedAt',
                  label: 'Acknowledged',
                  render: (r) => formatWhen(r.acknowledgedAt),
                },
                {
                  key: 'result',
                  label: 'Result',
                  render: (r) =>
                    r.result ? (
                      <code className="text-[11px] text-slate-600">
                        {JSON.stringify(r.result).slice(0, 60)}
                      </code>
                    ) : (
                      <span className="text-[#a19f9d]">—</span>
                    ),
                },
              ]}
            />
          </div>
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#605e5c]">
        Commands queue for device/gateway poll. Deferred: MQTT Nest bridge, live
        map, virus scan on snapshots.
      </p>

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
    </div>
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
    <Modal
      title="Issue command"
      description="Queued for the device/gateway to poll and execute."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[#323130]">
          Command type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DeviceCommandType)}
            className={inputCls}
          >
            {DEVICE_COMMAND_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Payload (JSON){' '}
          <span className="font-normal text-[#605e5c]">(optional)</span>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className={`${inputCls} h-32 font-mono text-xs`}
            spellCheck={false}
          />
        </label>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Issuing…' : 'Issue command'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
