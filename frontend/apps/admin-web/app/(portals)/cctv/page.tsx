'use client';

import {
  checkServiceHealth,
  listAnprResults,
  listDeviceEvents,
  listDevices,
  listSites,
  type AnprResult,
  type Device,
  type DeviceEvent,
  type Site,
} from '@pssms/api-client';
import { AZURE, btnPrimary, btnSecondary } from '@pssms/ui';
import {
  Camera,
  LayoutGrid,
  Plus,
  RotateCw,
  ScanLine,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CameraFocusDrawer } from './_components/CameraFocusDrawer';
import { CameraTile, EmptyMonitorSlot } from './_components/CameraTile';
import { ConnectCameraModal } from './_components/ConnectCameraModal';
import { SidePanels } from './_components/SidePanels';
import {
  GRID_SIZES,
  VISION_URL,
  WALL,
  type GridSize,
  gridClass,
  isDeviceOnline,
  isToday,
} from './_components/shared';

export default function CctvPage() {
  const [cameras, setCameras] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [anpr, setAnpr] = useState<AnprResult[]>([]);
  const [alerts, setAlerts] = useState<DeviceEvent[]>([]);
  const [eventsAvailable, setEventsAvailable] = useState(true);
  const [vision, setVision] = useState('…');
  const [loading, setLoading] = useState(true);
  const [gridSize, setGridSize] = useState<GridSize>(9);
  const [connectOpen, setConnectOpen] = useState(false);
  const [focus, setFocus] = useState<Device | null>(null);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, `${s.code} · ${s.name}`);
    return m;
  }, [sites]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [health, cams, siteList, anprRows, eventsResult] =
        await Promise.all([
          checkServiceHealth(VISION_URL, '/health'),
          listDevices({ type: 'CCTV_CAMERA' }).catch(() => [] as Device[]),
          listSites().catch(() => [] as Site[]),
          listAnprResults().catch(() => [] as AnprResult[]),
          listDeviceEvents({ type: 'CCTV_EVENT', limit: 40 })
            .then((rows) => ({ ok: true as const, rows }))
            .catch(() => ({ ok: false as const, rows: [] as DeviceEvent[] })),
        ]);
      setVision(health.status);
      setCameras(cams);
      setSites(siteList);
      setAnpr(anprRows);
      setEventsAvailable(eventsResult.ok);
      setAlerts(eventsResult.rows);
      setFocus((prev) =>
        prev ? cams.find((c) => c.id === prev.id) ?? null : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visionOnline =
    vision !== '…' && !['down', 'offline', 'error'].includes(vision.toLowerCase());

  const kpis = useMemo(() => {
    const online = cameras.filter((c) => isDeviceOnline(c.status)).length;
    const anprToday = anpr.filter((r) => isToday(r.capturedAt)).length;
    const openAlerts = alerts.filter(
      (e) => !['PROCESSED', 'IGNORED'].includes(e.status),
    ).length;
    return {
      online,
      total: cameras.length,
      anprToday,
      openAlerts,
    };
  }, [cameras, anpr, alerts]);

  const mosaic = useMemo(() => {
    const shown = cameras.slice(0, gridSize);
    const empties = Math.max(0, gridSize - shown.length);
    return { shown, empties };
  }, [cameras, gridSize]);

  const focusSite = focus?.siteId
    ? siteMap.get(focus.siteId)
    : undefined;

  return (
    <div className="pb-6">
      {/* Colored control-room hero + KPI strip */}
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
                    'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
                }}
              >
                <Video className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-300/30">
                    Portal 35.22
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                    NVR · ONVIF · metadata
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  CCTV / Security Monitoring
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Connect site cameras on your hosted server — mosaic tiles use
                  NVR embed URLs. PSSMS stores registry + AI/ANPR events only
                  (video never through Nest).
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Hikvision', 'Dahua', 'Uniview', 'Axis', 'ONVIF'].map(
                    (v) => (
                      <span
                        key={v}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10"
                      >
                        {v}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-white/15 bg-black/20 p-0.5 backdrop-blur-sm"
                role="group"
                aria-label="Mosaic grid size"
              >
                {GRID_SIZES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGridSize(n)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      gridSize === n
                        ? 'bg-sky-400 text-[#072033] shadow'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                    title={`${n}-tile wall`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {n}
                  </button>
                ))}
              </div>
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
                onClick={() => setConnectOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
              >
                <Plus className="h-4 w-4" />
                Connect camera
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Vision status"
              value={loading ? '…' : visionOnline ? 'Online' : 'Offline'}
              hint={VISION_URL.replace(/^https?:\/\//, '')}
              tone={visionOnline ? 'emerald' : 'rose'}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <Kpi
              label="Cameras online"
              value={loading ? '…' : `${kpis.online}/${kpis.total}`}
              hint="Registered CCTV_CAMERA devices"
              tone="sky"
              icon={<Camera className="h-4 w-4" />}
            />
            <Kpi
              label="ANPR today"
              value={loading ? '…' : kpis.anprToday}
              hint="Plate captures since midnight"
              tone="cyan"
              icon={<ScanLine className="h-4 w-4" />}
            />
            <Kpi
              label="Open AI alerts"
              value={loading ? '…' : kpis.openAlerts}
              hint={
                eventsAvailable
                  ? 'Unprocessed CCTV_EVENT'
                  : 'Events endpoint pending'
              }
              tone={kpis.openAlerts > 0 ? 'amber' : 'slate'}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      {/* Monitoring wall */}
      <section
        className="overflow-hidden rounded-xl shadow-lg"
        style={{
          background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
          border: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${visionOnline ? 'animate-pulse' : ''}`}
              style={{
                background: visionOnline ? WALL.online : WALL.offline,
              }}
            />
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: WALL.muted }}
            >
              Monitoring wall · {gridSize}-tile mosaic
            </p>
          </div>
          <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
            HIGHLINK · CONTROL ROOM
          </p>
        </div>

        <div className="p-3 sm:p-4">
          {cameras.length === 0 && !loading ? (
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
                <Camera className="h-7 w-7" style={{ color: WALL.muted }} />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  No cameras on the wall
                </p>
                <p
                  className="mx-auto mt-1 max-w-sm text-sm"
                  style={{ color: WALL.muted }}
                >
                  Connect a CCTV_CAMERA device to populate the mosaic. Until seed
                  or registration, the wall stays empty — video never passes
                  through Nest.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className={btnPrimary}
              >
                <Plus className="h-4 w-4" />
                Connect first camera
              </button>
            </div>
          ) : (
            <div className={`grid gap-2 sm:gap-3 ${gridClass(gridSize)}`}>
              {mosaic.shown.map((cam) => (
                <CameraTile
                  key={cam.id}
                  device={cam}
                  siteLabel={
                    cam.siteId ? siteMap.get(cam.siteId) : undefined
                  }
                  onSelect={setFocus}
                />
              ))}
              {Array.from({ length: mosaic.empties }, (_, i) => (
                <EmptyMonitorSlot key={`slot-${i}`} index={mosaic.shown.length + i} />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <SidePanels
            alerts={alerts}
            anpr={anpr}
            eventsAvailable={eventsAvailable}
            onTriaged={load}
          />
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#605e5c]">
        Hosted on your server: register each camera with its NVR web-view /
        ONVIF embed URL (reachable from operator browsers). Deferred: native
        vendor SDKs, MQTT barriers, snapshot virus scan.
      </p>

      {connectOpen ? (
        <ConnectCameraModal
          sites={sites}
          onClose={() => setConnectOpen(false)}
          onCreated={() => {
            setConnectOpen(false);
            void load();
          }}
        />
      ) : null}

      {focus ? (
        <CameraFocusDrawer
          device={focus}
          siteLabel={focusSite}
          onClose={() => setFocus(null)}
        />
      ) : null}
    </div>
  );
}

const KPI_TONES = {
  emerald: {
    card: 'from-emerald-500/25 to-emerald-950/40 ring-emerald-400/35',
    icon: 'bg-emerald-400/25 text-emerald-200',
    value: 'text-emerald-50',
    bar: 'bg-emerald-400',
  },
  rose: {
    card: 'from-rose-500/30 to-rose-950/40 ring-rose-400/35',
    icon: 'bg-rose-400/25 text-rose-200',
    value: 'text-rose-50',
    bar: 'bg-rose-400',
  },
  sky: {
    card: 'from-sky-500/25 to-sky-950/40 ring-sky-400/35',
    icon: 'bg-sky-400/25 text-sky-200',
    value: 'text-sky-50',
    bar: 'bg-sky-400',
  },
  cyan: {
    card: 'from-cyan-500/25 to-cyan-950/40 ring-cyan-400/35',
    icon: 'bg-cyan-400/25 text-cyan-200',
    value: 'text-cyan-50',
    bar: 'bg-cyan-400',
  },
  amber: {
    card: 'from-amber-500/30 to-amber-950/40 ring-amber-400/40',
    icon: 'bg-amber-400/25 text-amber-200',
    value: 'text-amber-50',
    bar: 'bg-amber-400',
  },
  slate: {
    card: 'from-slate-500/20 to-slate-950/40 ring-slate-400/25',
    icon: 'bg-slate-400/20 text-slate-200',
    value: 'text-slate-50',
    bar: 'bg-slate-400',
  },
} as const;

function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: keyof typeof KPI_TONES;
  icon: ReactNode;
}) {
  const t = KPI_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${t.card} px-4 py-3.5 ring-1 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1 ${t.bar}`}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 pl-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-1.5 pl-1 text-2xl font-bold tracking-tight ${t.value}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate pl-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
