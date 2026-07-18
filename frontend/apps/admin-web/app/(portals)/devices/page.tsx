'use client';

import {
  DEVICE_CONNECTIONS,
  DEVICE_TYPES,
  listDevices,
  listGateways,
  registerDevice,
  registerGateway,
  type Device,
  type DeviceConnection,
  type DeviceType,
  type EdgeGateway,
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
import {
  Check,
  Copy,
  Cpu,
  HardDrive,
  RotateCw,
  Router,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const isOnline = (status: string) => status === 'ONLINE';

function relativeTime(value?: string | null): string {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function ApiKeyReveal({ label, apiKey }: { label: string; apiKey: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800">
        {label} — copy now, it is shown only once
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs text-slate-800">
          {apiKey}
        </code>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            void navigator.clipboard?.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [gateways, setGateways] = useState<EdgeGateway[]>([]);
  const [loading, setLoading] = useState(true);

  const [gwOpen, setGwOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState<{ label: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, g] = await Promise.all([
        listDevices().catch(() => [] as Device[]),
        listGateways().catch(() => [] as EdgeGateway[]),
      ]);
      setDevices(d);
      setGateways(g);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => isOnline(d.status)).length;
    const disabled = devices.filter((d) => d.status === 'DISABLED').length;
    return { total, online, offline: total - online - disabled, gateways: gateways.length };
  }, [devices, gateways]);

  return (
    <>
      <PageHeader
        title="Devices"
        description="Edge gateways and field devices — biometrics, scanners, printers, RFID."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className={btnSecondary}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={() => setGwOpen(true)} className={btnSecondary}>
              New gateway
            </button>
            <button type="button" onClick={() => setDevOpen(true)} className={btnPrimary}>
              New device
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total devices" value={stats.total} hint="Registered field devices" accent="blue" icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Online" value={stats.online} hint="Reporting heartbeats" accent="emerald" icon={<Wifi className="h-5 w-5" />} />
        <StatCard label="Offline / pending" value={stats.offline} hint="No recent heartbeat" accent="amber" icon={<HardDrive className="h-5 w-5" />} />
        <StatCard label="Edge gateways" value={stats.gateways} hint="On-site hubs" accent="violet" icon={<Router className="h-5 w-5" />} />
      </div>

      <div className="mt-8">
        <SectionTitle>Edge gateways</SectionTitle>
        <DataTable<EdgeGateway>
          loading={loading}
          keyField="id"
          rows={gateways}
          emptyMessage="No edge gateways registered yet."
          columns={[
            { key: 'code', label: 'Code', render: (r) => <span className="font-medium text-[#1b1a19]">{r.code}</span> },
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'version', label: 'Version', render: (r) => r.version ?? '—' },
            { key: 'lastHeartbeatAt', label: 'Last heartbeat', render: (r) => relativeTime(r.lastHeartbeatAt) },
          ]}
        />
      </div>

      <div className="mt-8">
        <SectionTitle>Devices</SectionTitle>
        <DataTable<Device>
          loading={loading}
          keyField="id"
          rows={devices}
          emptyMessage="No devices registered yet."
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (r) => (
                <Link href={`/devices/${r.id}`} className="font-medium text-[#0067b8] hover:underline">
                  {r.code}
                </Link>
              ),
            },
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type', render: (r) => <span className="text-xs">{r.type.replace(/_/g, ' ')}</span> },
            { key: 'connection', label: 'Conn.' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'lastSeenAt', label: 'Last seen', render: (r) => relativeTime(r.lastSeenAt) },
          ]}
        />
      </div>

      {gwOpen ? (
        <GatewayModal
          onClose={() => setGwOpen(false)}
          onCreated={(key) => {
            setGwOpen(false);
            if (key) setIssuedKey({ label: 'Gateway API key', key });
            void load();
          }}
        />
      ) : null}

      {devOpen ? (
        <DeviceModal
          gateways={gateways}
          onClose={() => setDevOpen(false)}
          onCreated={(key) => {
            setDevOpen(false);
            if (key) setIssuedKey({ label: 'Device API key', key });
            void load();
          }}
        />
      ) : null}

      {issuedKey ? (
        <Modal
          title="Credential issued"
          description="Store this key securely — it cannot be retrieved again."
          onClose={() => setIssuedKey(null)}
        >
          <ApiKeyReveal label={issuedKey.label} apiKey={issuedKey.key} />
          <div className="mt-4 flex justify-end">
            <button type="button" className={btnPrimary} onClick={() => setIssuedKey(null)}>
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function GatewayModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (apiKey?: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const gw = await registerGateway({ code, name, siteId: siteId.trim() || undefined });
      onCreated(gw.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New edge gateway" description="A site hub that forwards USB device traffic." onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[#323130]">
          Code
          <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="GW-HQ-01" required />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="HQ Gate Edge Gateway" required />
        </label>
        <label className="block text-sm font-medium text-[#323130]">
          Site ID <span className="font-normal text-[#605e5c]">(optional)</span>
          <input value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls} placeholder="site UUID" />
        </label>
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register gateway'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeviceModal({
  gateways,
  onClose,
  onCreated,
}: {
  gateways: EdgeGateway[];
  onClose: () => void;
  onCreated: (apiKey?: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('FINGERPRINT_SCANNER');
  const [connection, setConnection] = useState<DeviceConnection>('USB');
  const [edgeGatewayId, setEdgeGatewayId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [directPush, setDirectPush] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const dev = await registerDevice({
        code,
        name,
        type,
        connection,
        edgeGatewayId: edgeGatewayId || undefined,
        siteId: siteId.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        directPush,
      });
      onCreated(dev.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New device" description="Register a field device and bind it to a gateway or direct push." onClose={onClose} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="FP-HQ-01" required />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Reception Fingerprint" required />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as DeviceType)} className={inputCls}>
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Connection
            <select value={connection} onChange={(e) => setConnection(e.target.value as DeviceConnection)} className={inputCls}>
              {DEVICE_CONNECTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Edge gateway <span className="font-normal text-[#605e5c]">(USB devices)</span>
            <select value={edgeGatewayId} onChange={(e) => setEdgeGatewayId(e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {gateways.map((g) => (
                <option key={g.id} value={g.id}>{g.code}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Serial number <span className="font-normal text-[#605e5c]">(optional)</span>
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={inputCls} placeholder="for iClock/ADMS terminals" />
          </label>
        </div>
        <label className="block text-sm font-medium text-[#323130]">
          Site ID <span className="font-normal text-[#605e5c]">(optional — enables domain routing)</span>
          <input value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls} placeholder="site UUID" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-[#323130]">
          <input type="checkbox" checked={directPush} onChange={(e) => setDirectPush(e.target.checked)} />
          Issue a direct device API key (network terminals that push on their own)
        </label>
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register device'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
