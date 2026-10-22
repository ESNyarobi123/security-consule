'use client';

import {
  checkServiceHealth,
  getCctvOverview,
  listDevices,
  listSites,
  type CctvOverview,
  type Device,
  type Site,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { AZURE, btnPrimary } from '@pssms/ui';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Car,
  ClipboardCheck,
  Footprints,
  LayoutGrid,
  Plus,
  RotateCw,
  ShieldAlert,
  Siren,
  UserCheck,
  Video,
} from 'lucide-react';
import Link from 'next/link';
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
  cameraLabel,
  formatAge,
  gridClass,
  isDeviceOnline,
} from './_components/shared';

type LabelRow = {
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
};

export default function CctvPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  // Camera registration is Field Ops (`operations.manage`); monitoring is not.
  const canConnect = can(sessionUser, 'operations.manage');
  const [cameras, setCameras] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [overview, setOverview] = useState<CctvOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [vision, setVision] = useState('…');
  const [loading, setLoading] = useState(true);
  const [gridSize, setGridSize] = useState<GridSize>(9);
  const [siteFilter, setSiteFilter] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [focus, setFocus] = useState<Device | null>(null);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, `${s.code} · ${s.name}`);
    // Supervisors cannot read the enterprise site catalogue — reuse the labels
    // already embedded in the monitoring payload instead of blank tiles.
    const remember = (rows?: LabelRow[] | null) => {
      for (const row of rows ?? []) {
        if (row.siteId && row.siteCode && !m.has(row.siteId)) {
          m.set(row.siteId, `${row.siteCode} · ${row.siteName ?? ''}`);
        }
      }
    };
    remember(overview?.aiAlerts.latest.map((a) => ({
      siteId: a.siteId,
      siteCode: a.siteCode,
      siteName: a.siteName,
    })));
    remember(overview?.parking.latestEntries);
    remember(overview?.access.latest as LabelRow[] | undefined);
    remember(overview?.patrols.latest as LabelRow[] | undefined);
    remember(overview?.alarms.latest as LabelRow[] | undefined);
    remember(overview?.incidents.latest as LabelRow[] | undefined);
    return m;
  }, [sites, overview]);

  const load = useCallback(async () => {
    setLoading(true);
    setOverviewError(null);
    try {
      const [health, cams, siteList, pack] = await Promise.all([
        checkServiceHealth(VISION_URL, '/health').catch(() => ({ status: 'offline' })),
        listDevices({ type: 'CCTV_CAMERA' }).catch(() => [] as Device[]),
        listSites().catch(() => [] as Site[]),
        getCctvOverview(siteFilter || undefined)
          .then((res) => ({ ok: true as const, res }))
          .catch((e: unknown) => ({
            ok: false as const,
            error: e instanceof Error ? e.message : String(e),
          })),
      ]);
      setVision(health.status);
      setCameras(cams);
      setSites(siteList);
      if (pack.ok) {
        setOverview(pack.res);
      } else {
        setOverview(null);
        setOverviewError(pack.error);
      }
      setFocus((prev) =>
        prev ? cams.find((c) => c.id === prev.id) ?? null : null,
      );
    } finally {
      setLoading(false);
    }
  }, [siteFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visionOnline =
    vision !== '…' && !['down', 'offline', 'error'].includes(vision.toLowerCase());

  const siteOptions = useMemo(() => {
    const rows = sites.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
    if (rows.length) return rows;
    // Supervisors cannot read the site catalogue — reuse labels from the feed.
    return [...siteMap.entries()].map(([id, label]) => ({ id, label }));
  }, [sites, siteMap]);

  const visibleCameras = useMemo(
    () => (siteFilter ? cameras.filter((c) => c.siteId === siteFilter) : cameras),
    [cameras, siteFilter],
  );

  const mosaic = useMemo(() => {
    const shown = visibleCameras.slice(0, gridSize);
    const empties = Math.max(0, gridSize - shown.length);
    return { shown, empties };
  }, [visibleCameras, gridSize]);

  const focusSite = focus?.siteId ? siteMap.get(focus.siteId) : undefined;

  const ai = overview?.aiAlerts;
  const parking = overview?.parking;
  const access = overview?.access;
  const patrols = overview?.patrols;
  const alarms = overview?.alarms;
  const incidents = overview?.incidents;

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
                    CCTV · AI · parking · access · patrols · alarms
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  CCTV / Security Monitoring
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  One control-room view for every monitored area — camera wall,
                  AI alerts, parking gates, customer-employee access, patrol
                  scans, alarms and security incidents. Video stays on the NVR;
                  PSSMS keeps metadata, snapshots and audit only.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Hikvision', 'Dahua', 'Uniview', 'Axis', 'ONVIF'].map((v) => (
                    <span
                      key={v}
                      className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/20 px-2.5 py-1.5 backdrop-blur-sm">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                  Site
                </span>
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="max-w-[13rem] truncate bg-transparent text-xs font-semibold text-white outline-none [&>option]:text-[#1b1a19]"
                  aria-label="Filter monitoring wall by site"
                >
                  <option value="">All granted sites</option>
                  {siteOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
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
                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {canConnect ? (
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
                >
                  <Plus className="h-4 w-4" />
                  Connect camera
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Cameras online"
              value={
                loading
                  ? '…'
                  : `${overview?.cameras.online ?? cameras.filter((c) => isDeviceOnline(c.status)).length}/${
                      overview?.cameras.total ?? cameras.length
                    }`
              }
              hint={
                overview?.cameras.offline
                  ? `${overview.cameras.offline} offline — check the mosaic`
                  : 'All registered CCTV_CAMERA devices'
              }
              tone={overview?.cameras.offline ? 'amber' : 'emerald'}
              icon={<Camera className="h-4 w-4" />}
            />
            <Kpi
              label="Open AI alerts"
              value={loading ? '…' : ai?.open ?? 0}
              hint={
                ai
                  ? `${ai.critical} critical · ${ai.high} high · ${ai.medium} medium`
                  : 'Alerts endpoint unavailable'
              }
              tone={ai && ai.critical > 0 ? 'rose' : ai && ai.open > 0 ? 'amber' : 'slate'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <Kpi
              label="Parking (24h)"
              value={loading ? '…' : parking?.entries24h ?? 0}
              hint={
                parking
                  ? `${parking.denies24h} denies · ${
                      parking.utilizationPct != null
                        ? `${parking.utilizationPct}% occupied`
                        : 'occupancy n/a'
                    }`
                  : 'Parking monitor unavailable'
              }
              tone={parking?.denies24h ? 'amber' : 'sky'}
              icon={<Car className="h-4 w-4" />}
            />
            <Kpi
              label="Access control (24h)"
              value={
                loading
                  ? '…'
                  : `${access?.checkIns24h ?? 0}/${access?.checkOuts24h ?? 0}`
              }
              hint={
                access
                  ? `${access.visitorDenies24h} visitor gate denies`
                  : 'Access monitor unavailable'
              }
              tone={access?.visitorDenies24h ? 'amber' : 'cyan'}
              icon={<UserCheck className="h-4 w-4" />}
            />
            <Kpi
              label="Patrol scans (24h)"
              value={loading ? '…' : patrols?.scans24h ?? 0}
              hint={
                patrols
                  ? `${patrols.missedOpen} missed patrol${
                      patrols.missedOpen === 1 ? '' : 's'
                    } open`
                  : 'Patrol monitor unavailable'
              }
              tone={patrols?.missedOpen ? 'rose' : 'emerald'}
              icon={<Footprints className="h-4 w-4" />}
            />
            <Kpi
              label="Alarms open"
              value={loading ? '…' : alarms?.openTotal ?? 0}
              hint={
                alarms
                  ? `${alarms.openHigh} HIGH/CRITICAL · ${alarms.failedCameraEvents} camera failures`
                  : 'Alarm monitor unavailable'
              }
              tone={alarms?.openHigh ? 'rose' : 'slate'}
              icon={<Siren className="h-4 w-4" />}
            />
            <Kpi
              label="Security incidents"
              value={loading ? '…' : incidents?.open ?? 0}
              hint={
                incidents
                  ? `${incidents.critical} critical · read-only, close on Branch Ops`
                  : 'Incident monitor unavailable'
              }
              tone={incidents?.critical ? 'rose' : 'sky'}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <Kpi
              label="Vision service"
              value={loading ? '…' : visionOnline ? 'Online' : 'Offline'}
              hint={VISION_URL.replace(/^https?:\/\//, '')}
              tone={visionOnline ? 'emerald' : 'rose'}
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
          </div>

          {overviewError ? (
            <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs text-amber-100">
              Monitoring overview unavailable ({overviewError}). The wall still
              shows cameras; alerts and area strips need the core-api.
            </p>
          ) : null}
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
              style={{ background: visionOnline ? WALL.online : WALL.offline }}
            />
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: WALL.muted }}
            >
              Monitoring wall · {gridSize}-tile mosaic
              {overview?.filters.siteCode ? ` · ${overview.filters.siteCode}` : ''}
            </p>
          </div>
          <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
            HIGHLINK · CONTROL ROOM
          </p>
        </div>

        <div className="p-3 sm:p-4">
          {visibleCameras.length === 0 && !loading ? (
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
                  {siteFilter ? 'No cameras at this site' : 'No cameras on the wall'}
                </p>
                <p
                  className="mx-auto mt-1 max-w-sm text-sm"
                  style={{ color: WALL.muted }}
                >
                  {siteFilter
                    ? 'No registered CCTV_CAMERA device is assigned to the selected site. Clear the site filter or connect a camera here.'
                    : 'Connect a CCTV_CAMERA device to populate the mosaic. Until seed or registration, the wall stays empty — video never passes through Nest.'}
                </p>
              </div>
              {canConnect ? (
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className={btnPrimary}
                >
                  <Plus className="h-4 w-4" />
                  Connect first camera
                </button>
              ) : null}
            </div>
          ) : (
            <div className={`grid gap-2 sm:gap-3 ${gridClass(gridSize)}`}>
              {mosaic.shown.map((cam) => (
                <CameraTile
                  key={cam.id}
                  device={cam}
                  siteLabel={cam.siteId ? siteMap.get(cam.siteId) : undefined}
                  onSelect={setFocus}
                />
              ))}
              {Array.from({ length: mosaic.empties }, (_, i) => (
                <EmptyMonitorSlot key={`slot-${i}`} index={mosaic.shown.length + i} />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 pb-3 sm:px-4">
          <SidePanels overview={overview} onTriaged={load} />
        </div>
      </section>

      {/* Monitored areas — the design says the portal monitors all of these */}
      <section className="mt-5">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1b1a19]">
              Monitored areas
            </h2>
            <p className="text-xs text-[#605e5c]">
              Live samples from each area this portal is required to monitor.
              Read-only here — action stays with the owning portal.
              {overview?.filters.siteName
                ? ` Focused on ${overview.filters.siteCode} · ${overview.filters.siteName}.`
                : ''}
            </p>
          </div>
          <Link
            href="/cctv/alerts"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0078d4] hover:underline"
          >
            Full AI alert inbox
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <AreaCard
            title="Parking areas"
            href="/cctv/parking"
            icon={<Car className="h-4 w-4" />}
            stats={
              parking
                ? [
                    `${parking.entries24h} entries`,
                    `${parking.denies24h} denies`,
                    `${parking.openViolations} violations`,
                    parking.utilizationPct != null
                      ? `${parking.utilizationPct}% occupied`
                      : 'occupancy n/a',
                  ]
                : []
            }
            rows={(parking?.latestEntries ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.plateNumber,
              middle: `${r.siteCode ?? '—'} · ${r.direction}`,
              right: r.decision,
            }))}
            empty="No gate activity in the last 24 hours."
          />
          <AreaCard
            title="Access control"
            href="/cctv/access"
            icon={<UserCheck className="h-4 w-4" />}
            stats={
              access
                ? [
                    `${access.checkIns24h} check-ins`,
                    `${access.checkOuts24h} check-outs`,
                    `${access.visitorDenies24h} visitor denies`,
                  ]
                : []
            }
            rows={(access?.latest ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.employeeName ?? r.employeeNumber ?? r.employeeId,
              middle: `${r.siteCode ?? '—'} · ${r.entryType.replace(/_/g, ' ')}`,
              right: r.accessMethod,
            }))}
            empty="No customer-employee punches in the last 24 hours."
          />
          <AreaCard
            title="Patrols"
            href="/cctv/patrols"
            icon={<Footprints className="h-4 w-4" />}
            stats={
              patrols
                ? [
                    `${patrols.scans24h} scans`,
                    `${patrols.missedOpen} missed open`,
                  ]
                : []
            }
            rows={(patrols?.latest ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.checkpointName ?? r.checkpointCode ?? 'Checkpoint',
              middle: `${r.guardName ?? r.employeeNumber ?? 'Guard'} · ${r.siteCode ?? '—'}`,
              right: r.method,
            }))}
            empty="No checkpoint scans yet."
          />
          <AreaCard
            title="Alarms"
            href="/cctv/alarms"
            icon={<Siren className="h-4 w-4" />}
            stats={
              alarms
                ? [
                    `${alarms.openTotal} open`,
                    `${alarms.openHigh} HIGH/CRITICAL`,
                    `${alarms.failedCameraEvents} camera failures`,
                  ]
                : []
            }
            rows={(alarms?.latest ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.alertType.replace(/_/g, ' '),
              middle: `${r.siteCode ?? '—'} · ${r.escalationStage}`,
              right: r.severity,
            }))}
            empty="No open alarms."
          />
          <AreaCard
            title="Security incidents"
            href="/cctv/incidents"
            icon={<ShieldAlert className="h-4 w-4" />}
            stats={
              incidents
                ? [`${incidents.open} open`, `${incidents.critical} critical`]
                : []
            }
            rows={(incidents?.latest ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.incidentNumber,
              middle: `${r.title} · ${r.siteCode ?? '—'}`,
              right: r.status,
            }))}
            empty="No open incidents."
          />
          <AreaCard
            title="AI alerts"
            href="/cctv/alerts"
            icon={<AlertTriangle className="h-4 w-4" />}
            stats={
              ai
                ? [
                    `${ai.open} open`,
                    `${ai.critical} critical`,
                    `${ai.high} high`,
                  ]
                : []
            }
            rows={(ai?.latest ?? []).slice(0, 4).map((r) => ({
              id: r.id,
              left: r.detectionLabel,
              middle: `${cameraLabel(r.camera)} · ${formatAge(r.ageMinutes)}`,
              right: r.severity,
            }))}
            empty="No open AI alerts."
            accent
          />
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#605e5c]">
        Hosted on your server: register each camera with its NVR web-view /
        ONVIF embed URL (reachable from operator browsers). Deferred: native
        vendor SDKs, MQTT barriers, snapshot virus scan.
      </p>

      {connectOpen && canConnect ? (
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

function AreaCard({
  title,
  href,
  icon,
  stats,
  rows,
  empty,
  accent,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  stats: string[];
  rows: { id: string; left: string; middle: string; right: string }[];
  empty: string;
  accent?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        accent ? 'border-amber-200' : 'border-[#e1dfdd]'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[#edebe9] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              accent ? 'bg-amber-50 text-amber-700' : 'bg-[#deecf9] text-[#0078d4]'
            }`}
          >
            {icon}
          </span>
          <h3 className="truncate text-[13px] font-semibold text-[#1b1a19]">
            {title}
          </h3>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold text-[#0078d4] hover:underline"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="flex flex-wrap gap-1 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-1.5">
        {stats.length === 0 ? (
          <span className="text-[11px] text-[#8a8886]">No signal</span>
        ) : (
          stats.map((s) => (
            <span
              key={s}
              className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#605e5c] ring-1 ring-[#e1dfdd]"
            >
              {s}
            </span>
          ))
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-[#8a8886]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[#f3f2f1]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#1b1a19]">
                  {r.left}
                </p>
                <p className="truncate text-[10px] text-[#605e5c]">{r.middle}</p>
              </div>
              <span className="shrink-0 rounded bg-[#f3f2f1] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#605e5c]">
                {r.right}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
      <span className={`absolute left-0 top-0 h-full w-1 ${t.bar}`} aria-hidden />
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
      <p className={`mt-1.5 pl-1 text-2xl font-bold tracking-tight ${t.value}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate pl-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
