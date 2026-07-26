'use client';

import {
  DEVICE_TYPES,
  listDeviceEvents,
  listDevices,
  listGateways,
  listSites,
  type Device,
  type DeviceEvent,
  type DeviceType,
  type EdgeGateway,
  type Site,
} from '@pssms/api-client';
import { AZURE, DataTable, Modal, StatusBadge, btnPrimary } from '@pssms/ui';
import {
  Cpu,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  RotateCw,
  Router,
  Search,
  Wifi,
  RadioTower,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiKeyReveal } from './_components/ApiKeyReveal';
import { DeviceCard } from './_components/DeviceCard';
import { DeviceDetailDrawer } from './_components/DeviceDetailDrawer';
import { GatewayCard } from './_components/GatewayCard';
import { RegisterDeviceModal } from './_components/RegisterDeviceModal';
import { RegisterGatewayModal } from './_components/RegisterGatewayModal';
import {
  KpiCard,
  STATUS_CHIPS,
  TYPE_CHIPS,
  WALL,
  deviceLabelForEvent,
  formatDeviceType,
  isDeviceOnline,
  matchesDeviceSearch,
  matchesGatewaySearch,
  matchesStatus,
  relativeTime,
  resolveSiteLabel,
  type DevicesTab,
  type RosterView,
  type StatusFilter,
} from './_components/shared';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [gateways, setGateways] = useState<EdgeGateway[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [eventsAvailable, setEventsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<DevicesTab>('devices');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<DeviceType | ''>('');
  const [view, setView] = useState<RosterView>('cards');

  const [gwOpen, setGwOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [focus, setFocus] = useState<Device | null>(null);
  const [issuedKey, setIssuedKey] = useState<{
    label: string;
    key: string;
  } | null>(null);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, `${s.code} · ${s.name}`);
    return m;
  }, [sites]);

  const gatewayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of gateways) m.set(g.id, `${g.code} · ${g.name}`);
    return m;
  }, [gateways]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [devResult, gwResult, siteList, eventsResult] = await Promise.all([
        listDevices()
          .then((rows) => ({ ok: true as const, rows }))
          .catch(() => ({ ok: false as const, rows: [] as Device[] })),
        listGateways()
          .then((rows) => ({ ok: true as const, rows }))
          .catch(() => ({ ok: false as const, rows: [] as EdgeGateway[] })),
        listSites().catch(() => [] as Site[]),
        listDeviceEvents({ limit: 40 })
          .then((rows) => ({ ok: true as const, rows }))
          .catch(() => ({ ok: false as const, rows: [] as DeviceEvent[] })),
      ]);
      setDevices(devResult.rows);
      setGateways(gwResult.rows);
      setSites(siteList);
      setEventsAvailable(eventsResult.ok);
      setEvents(eventsResult.rows);
      if (!devResult.ok || !gwResult.ok) {
        setError(
          'Some device data failed to load (check operations.manage and API).',
        );
      }
      setFocus((prev) =>
        prev
          ? devResult.rows.find((x) => x.id === prev.id) ?? null
          : null,
      );
    } catch {
      setError('Could not load devices. Check auth and API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => isDeviceOnline(d.status)).length;
    const disabled = devices.filter((d) => d.status === 'DISABLED').length;
    return {
      total,
      online,
      offline: Math.max(0, total - online - disabled),
      gateways: gateways.length,
    };
  }, [devices, gateways]);

  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          matchesStatus(d, statusFilter) &&
          matchesDeviceSearch(d, query) &&
          (!typeFilter || d.type === typeFilter),
      ),
    [devices, statusFilter, query, typeFilter],
  );

  const filteredGateways = useMemo(
    () => gateways.filter((g) => matchesGatewaySearch(g, query)),
    [gateways, query],
  );

  const tabs: { id: DevicesTab; label: string; count: number }[] = [
    { id: 'devices', label: 'Devices', count: devices.length },
    { id: 'gateways', label: 'Gateways', count: gateways.length },
    { id: 'events', label: 'Recent events', count: events.length },
  ];

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
                className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-2 ring-white/15"
                style={{
                  background:
                    'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
                }}
              >
                <Cpu className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-300/30">
                    Field devices
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                    Portal · ops registry
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  Devices
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Unified edge gateways and field devices — biometrics,
                  scanners, printers, RFID, and CCTV cameras as registry
                  entries. Video never streams through Nest.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TYPE_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setTab('devices');
                        setTypeFilter(chip.types?.[0] ?? '');
                      }}
                      className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/15"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                onClick={() => setGwOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                <Router className="h-4 w-4" />
                New gateway
              </button>
              <button
                type="button"
                onClick={() => setDevOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
              >
                <Plus className="h-4 w-4" />
                New device
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total devices"
              value={loading ? '…' : stats.total}
              hint="Registered field devices"
              tone="sky"
              icon={<Cpu className="h-4 w-4" />}
            />
            <KpiCard
              label="Online"
              value={loading ? '…' : stats.online}
              hint={
                stats.total > 0
                  ? `${Math.round((stats.online / stats.total) * 100)}% reporting`
                  : 'No devices yet'
              }
              tone="emerald"
              icon={<Wifi className="h-4 w-4" />}
            />
            <KpiCard
              label="Offline / pending"
              value={loading ? '…' : stats.offline}
              hint="No recent heartbeat"
              tone="amber"
              icon={<HardDrive className="h-4 w-4" />}
            />
            <KpiCard
              label="Edge gateways"
              value={loading ? '…' : stats.gateways}
              hint="On-site hubs"
              tone="teal"
              icon={<Router className="h-4 w-4" />}
            />
          </div>
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
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div
            className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/20 p-0.5"
            role="tablist"
            aria-label="Devices sections"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-sky-400 text-[#072033] shadow'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
            HIGHLINK · CONTROL ROOM
          </p>
        </div>

        <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">
          {tab !== 'events' ? (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block min-w-0 flex-1 lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === 'gateways'
                      ? 'Search gateway code, name…'
                      : 'Search code, name, vendor…'
                  }
                  className="w-full rounded-lg border border-white/15 bg-black/25 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none ring-sky-400/40 focus:ring-2"
                />
              </label>

              {tab === 'devices' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/20 p-0.5"
                    role="group"
                    aria-label="Status filter"
                  >
                    {STATUS_CHIPS.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setStatusFilter(chip.id)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                          statusFilter === chip.id
                            ? 'bg-sky-400 text-[#072033] shadow'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as DeviceType | '')
                    }
                    className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none ring-sky-400/40 focus:ring-2"
                    aria-label="Device type"
                  >
                    <option value="">All types</option>
                    {DEVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatDeviceType(t)}
                      </option>
                    ))}
                  </select>

                  <div
                    className="inline-flex rounded-lg border border-white/15 bg-black/20 p-0.5"
                    role="group"
                    aria-label="View mode"
                  >
                    <button
                      type="button"
                      onClick={() => setView('cards')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        view === 'cards'
                          ? 'bg-sky-400 text-[#072033] shadow'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                        view === 'list'
                          ? 'bg-sky-400 text-[#072033] shadow'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <List className="h-3.5 w-3.5" />
                      List
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/30">
              {error}
            </p>
          ) : null}

          {tab === 'devices' ? (
            <DevicesPanel
              loading={loading}
              devices={devices}
              filtered={filteredDevices}
              view={view}
              siteMap={siteMap}
              onOpen={setFocus}
              onRefresh={() => void load()}
              onNew={() => setDevOpen(true)}
            />
          ) : null}

          {tab === 'gateways' ? (
            <GatewaysPanel
              loading={loading}
              gateways={gateways}
              filtered={filteredGateways}
              siteMap={siteMap}
              onRefresh={() => void load()}
              onNew={() => setGwOpen(true)}
            />
          ) : null}

          {tab === 'events' ? (
            <EventsPanel
              loading={loading}
              events={events}
              devices={devices}
              eventsAvailable={eventsAvailable}
              onRefresh={() => void load()}
            />
          ) : null}
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#605e5c]">
        Field device registry + edge gateways (`operations.manage`). CCTV
        cameras open on the monitoring wall — video stays on NVR. Deferred: MQTT
        Nest bridge, live site map, device snapshot virus scan.
      </p>

      {gwOpen ? (
        <RegisterGatewayModal
          sites={sites}
          onClose={() => setGwOpen(false)}
          onCreated={(key) => {
            setGwOpen(false);
            if (key) setIssuedKey({ label: 'Gateway API key', key });
            void load();
          }}
        />
      ) : null}

      {devOpen ? (
        <RegisterDeviceModal
          gateways={gateways}
          sites={sites}
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
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setIssuedKey(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}

      {focus ? (
        <DeviceDetailDrawer
          device={focus}
          siteLabel={resolveSiteLabel(focus, siteMap)}
          gatewayLabel={
            focus.edgeGatewayId
              ? gatewayMap.get(focus.edgeGatewayId)
              : undefined
          }
          onClose={() => setFocus(null)}
        />
      ) : null}
    </div>
  );
}

function DevicesPanel({
  loading,
  devices,
  filtered,
  view,
  siteMap,
  onOpen,
  onRefresh,
  onNew,
}: {
  loading: boolean;
  devices: Device[];
  filtered: Device[];
  view: RosterView;
  siteMap: Map<string, string>;
  onOpen: (d: Device) => void;
  onRefresh: () => void;
  onNew: () => void;
}) {
  if (loading && devices.length === 0) {
    return <LoadingPanel label="Loading devices…" />;
  }

  if (filtered.length === 0) {
    return (
      <EmptyPanel
        icon={<Cpu className="h-7 w-7" style={{ color: WALL.muted }} />}
        title={
          devices.length === 0
            ? 'No devices registered'
            : 'No devices match this filter'
        }
        body={
          devices.length === 0
            ? 'Register biometrics, scanners, printers, RFID, or CCTV cameras to populate the registry.'
            : 'Try All, clear search, or adjust type / status filters.'
        }
        actionLabel={devices.length === 0 ? 'New device' : 'Refresh'}
        onAction={devices.length === 0 ? onNew : onRefresh}
      />
    );
  }

  if (view === 'cards') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            siteLabel={resolveSiteLabel(d, siteMap)}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white/95 shadow-inner">
      <DataTable
        loading={loading}
        keyField="id"
        rows={filtered}
        emptyMessage="No devices match."
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: (r) => (
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="text-left font-medium text-[#0078d4] hover:underline"
              >
                {r.code}
              </button>
            ),
          },
          { key: 'name', label: 'Name' },
          {
            key: 'type',
            label: 'Type',
            render: (r) => (
              <span className="text-xs">{formatDeviceType(r.type)}</span>
            ),
          },
          { key: 'connection', label: 'Conn.' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'lastSeenAt',
            label: 'Last seen',
            render: (r) => relativeTime(r.lastSeenAt),
          },
          {
            key: 'vendor',
            label: 'Vendor',
            render: (r) => r.vendor || '—',
          },
          {
            key: 'id',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/devices/${r.id}`}
                  className="text-xs font-medium text-[#0078d4] hover:underline"
                >
                  Detail
                </Link>
                {r.type === 'CCTV_CAMERA' ? (
                  <Link
                    href="/cctv"
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    CCTV wall
                  </Link>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function GatewaysPanel({
  loading,
  gateways,
  filtered,
  siteMap,
  onRefresh,
  onNew,
}: {
  loading: boolean;
  gateways: EdgeGateway[];
  filtered: EdgeGateway[];
  siteMap: Map<string, string>;
  onRefresh: () => void;
  onNew: () => void;
}) {
  if (loading && gateways.length === 0) {
    return <LoadingPanel label="Loading gateways…" />;
  }

  if (filtered.length === 0) {
    return (
      <EmptyPanel
        icon={<Router className="h-7 w-7" style={{ color: WALL.muted }} />}
        title={
          gateways.length === 0
            ? 'No edge gateways'
            : 'No gateways match this search'
        }
        body={
          gateways.length === 0
            ? 'Register a site hub to forward USB device traffic. API key is shown once.'
            : 'Clear search or refresh.'
        }
        actionLabel={gateways.length === 0 ? 'New gateway' : 'Refresh'}
        onAction={gateways.length === 0 ? onNew : onRefresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => (
          <GatewayCard
            key={g.id}
            gateway={g}
            siteLabel={resolveSiteLabel(g, siteMap)}
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg bg-white/95 shadow-inner">
        <DataTable
          loading={loading}
          keyField="id"
          rows={filtered}
          emptyMessage="No gateways."
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (r) => (
                <span className="font-medium text-[#1b1a19]">{r.code}</span>
              ),
            },
            { key: 'name', label: 'Name' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'version',
              label: 'Version',
              render: (r) => r.version ?? '—',
            },
            {
              key: 'lastHeartbeatAt',
              label: 'Last heartbeat',
              render: (r) => relativeTime(r.lastHeartbeatAt),
            },
            {
              key: 'siteId',
              label: 'Site',
              render: (r) => resolveSiteLabel(r, siteMap) ?? '—',
            },
          ]}
        />
      </div>
    </div>
  );
}

function EventsPanel({
  loading,
  events,
  devices,
  eventsAvailable,
  onRefresh,
}: {
  loading: boolean;
  events: DeviceEvent[];
  devices: Device[];
  eventsAvailable: boolean;
  onRefresh: () => void;
}) {
  if (loading && events.length === 0) {
    return <LoadingPanel label="Loading events…" />;
  }

  if (!eventsAvailable) {
    return (
      <EmptyPanel
        icon={
          <RadioTower className="h-7 w-7" style={{ color: WALL.muted }} />
        }
        title="Events endpoint unavailable"
        body="GET /devices/events could not be reached. Device ingest may still be running — try refresh after API is up."
        actionLabel="Refresh"
        onAction={onRefresh}
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyPanel
        icon={
          <RadioTower className="h-7 w-7" style={{ color: WALL.muted }} />
        }
        title="No recent device events"
        body="Ingested heartbeats, scans, and CCTV metadata will appear here (last 40)."
        actionLabel="Refresh"
        onAction={onRefresh}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white/95 shadow-inner">
      <DataTable
        loading={loading}
        keyField="id"
        rows={events}
        emptyMessage="No events."
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
            key: 'deviceId',
            label: 'Device',
            render: (r) => deviceLabelForEvent(r, devices),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'capturedAt',
            label: 'Time',
            render: (r) => relativeTime(r.capturedAt || r.receivedAt),
          },
          {
            key: 'routedTo',
            label: 'Routed',
            render: (r) => r.routedTo || '—',
          },
        ]}
      />
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg px-6 py-16 text-center"
      style={{
        border: `1px dashed ${WALL.borderStrong}`,
        background: 'rgba(15, 33, 55, 0.5)',
      }}
    >
      <RotateCw className="h-7 w-7 animate-spin text-sky-300" />
      <p className="text-sm text-slate-300">{label}</p>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg px-6 py-16 text-center"
      style={{
        border: `1px dashed ${WALL.borderStrong}`,
        background: 'rgba(15, 33, 55, 0.5)',
      }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          border: `1px solid ${WALL.borderStrong}`,
          background: WALL.panel,
        }}
      >
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-white">{title}</p>
        <p
          className="mx-auto mt-1 max-w-sm text-sm"
          style={{ color: WALL.muted }}
        >
          {body}
        </p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
      >
        {actionLabel}
      </button>
    </div>
  );
}
