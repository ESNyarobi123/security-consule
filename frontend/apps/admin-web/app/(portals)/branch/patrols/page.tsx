'use client';

import {
  createCheckpoint,
  createPatrolRoute,
  listCheckpoints,
  listPatrolRoutes,
  listPatrolScans,
  listSites,
  markPatrolRouteMissed,
  scanMissedPatrolRoutes,
  type Checkpoint,
  type PatrolRoute,
  type PatrolScan,
  type Site,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  Modal,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import { MapPinned, Plus, RefreshCw, Route, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime, shortId } from '../_components/shared';

type Section = 'routes' | 'checkpoints' | 'scans';

export default function BranchPatrolsPage() {
  const [section, setSection] = useState<Section>('routes');
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [scans, setScans] = useState<PatrolScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [createCpOpen, setCreateCpOpen] = useState(false);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const siteList = await listSites();
      setSites(siteList);
      const filter = siteId || undefined;
      const [cps, rts, ps] = await Promise.all([
        listCheckpoints(filter),
        listPatrolRoutes(filter),
        listPatrolScans(filter),
      ]);
      setCheckpoints(cps);
      setRoutes(rts);
      setScans(ps);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const siteLabel = (id: string) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.code} — ${s.name}` : shortId(id);
  };

  const coverageCounts = useMemo(() => {
    const c = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0 };
    for (const r of routes) c[r.coverageStatus] += 1;
    return c;
  }, [routes]);

  const slaCounts = useMemo(() => {
    const c = { OK: 0, ON_TRACK: 0, LATE: 0, MISSED: 0 };
    for (const r of routes) {
      if (r.slaStatus in c) c[r.slaStatus] += 1;
    }
    return c;
  }, [routes]);

  async function onScanMissed() {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await scanMissedPatrolRoutes(0);
      await refresh();
      if (res.markedMissed === 0) {
        setActionError('No past-due incomplete routes to mark missed.');
      }
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function onMarkMissed(id: string) {
    setActionBusy(true);
    setActionError(null);
    try {
      await markPatrolRouteMissed(id);
      await refresh();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <BranchShell
      title="Patrols"
      description="Patrol & Checkpoint (§29 + A4a): checkpoints, ordered routes, today’s coverage, and late/missed SLA → FieldAlert PATROL_MISSED (escalate on Field alerts)."
      actions={
        <>
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
          {section === 'routes' ? (
            <button
              type="button"
              onClick={() => void onScanMissed()}
              disabled={loading || actionBusy}
              className={btnSecondary}
            >
              Scan missed
            </button>
          ) : null}
          {section === 'checkpoints' ? (
            <button
              type="button"
              onClick={() => setCreateCpOpen(true)}
              className={btnPrimary}
              disabled={sites.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              New checkpoint
            </button>
          ) : null}
          {section === 'routes' ? (
            <button
              type="button"
              onClick={() => setCreateRouteOpen(true)}
              className={btnPrimary}
              disabled={sites.length === 0 || checkpoints.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              New route
            </button>
          ) : null}
        </>
      }
    >
      <p className="mb-4 rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
        Supervisor sets route + due window → Guard scans stops → Board shows
        coverage + SLA (ON_TRACK / LATE / MISSED). Scan missed raises{' '}
        <Link href="/branch/alerts" className="text-[#0078d4] underline">
          Field alerts
        </Link>{' '}
        (PATROL_MISSED) for escalate/ack. GPS map + on-spot→incident deferred.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] text-xs font-medium text-[#605e5c]">
          Site filter
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-1">
          {(
            [
              { id: 'routes' as const, label: 'Routes', icon: Route },
              { id: 'checkpoints' as const, label: 'Checkpoints', icon: MapPinned },
              { id: 'scans' as const, label: 'Scans', icon: ScanLine },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-white text-[#0078d4] shadow-sm ring-1 ring-[#e1dfdd]'
                    : 'text-[#605e5c] hover:bg-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        {section === 'routes' ? (
          <div className="flex flex-wrap gap-2 text-[11px] text-[#605e5c]">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Completed {coverageCounts.COMPLETED}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-100">
              In progress {coverageCounts.IN_PROGRESS}
            </span>
            <span className="rounded-full bg-[#f3f2f1] px-2 py-0.5 font-semibold text-[#605e5c] ring-1 ring-[#e1dfdd]">
              Not started {coverageCounts.NOT_STARTED}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200">
              Late {slaCounts.LATE}
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800 ring-1 ring-rose-100">
              Missed {slaCounts.MISSED}
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {actionError}
        </p>
      ) : null}

      {section === 'routes' ? (
        <GlassCard className="!p-0 overflow-hidden">
          {routes.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
              <Route className="h-5 w-5 text-[#a19f9d]" />
              <p>No patrol routes yet</p>
              <p className="max-w-sm text-xs">
                Create checkpoints first, then New route with an ordered stop
                list.
              </p>
            </div>
          ) : (
            <DataTable<PatrolRoute>
              loading={loading}
              keyField="id"
              rows={routes}
              emptyMessage="No routes"
              columns={[
                { key: 'name', label: 'Route' },
                {
                  key: 'siteId',
                  label: 'Site',
                  render: (r) => (
                    <span className="text-xs text-[#605e5c]">
                      {r.siteCode && r.siteName
                        ? `${r.siteCode} — ${r.siteName}`
                        : siteLabel(r.siteId)}
                    </span>
                  ),
                },
                {
                  key: 'checkpoints',
                  label: 'Stops',
                  render: (r) => (
                    <span className="font-mono text-[11px] text-[#605e5c]">
                      {r.checkpoints.map((c) => c.code).join(' → ') || '—'}
                    </span>
                  ),
                },
                {
                  key: 'scannedToday',
                  label: 'Today',
                  render: (r) => (
                    <span className="tabular-nums text-sm">
                      {r.scannedToday}/{r.checkpointCount}
                    </span>
                  ),
                },
                {
                  key: 'coverageStatus',
                  label: 'Coverage',
                  render: (r) => <StatusBadge status={r.coverageStatus} />,
                },
                {
                  key: 'slaStatus',
                  label: 'SLA',
                  render: (r) => <StatusBadge status={r.slaStatus} />,
                },
                {
                  key: 'dueAt',
                  label: 'Due',
                  render: (r) => (
                    <span className="text-xs text-[#605e5c]">
                      {formatDateTime(r.dueAt)}
                    </span>
                  ),
                },
                {
                  key: 'id',
                  label: 'Action',
                  render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {r.openPatrolAlertId ? (
                        <Link
                          href="/branch/alerts"
                          className="text-[11px] font-medium text-[#0078d4] underline"
                        >
                          Open alert
                        </Link>
                      ) : null}
                      {r.slaStatus === 'LATE' ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => void onMarkMissed(r.id)}
                          className="text-[11px] font-medium text-rose-700 underline disabled:opacity-50"
                        >
                          Mark missed
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      ) : null}

      {section === 'checkpoints' ? (
        <GlassCard className="!p-0 overflow-hidden">
          {checkpoints.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
              <MapPinned className="h-5 w-5 text-[#a19f9d]" />
              <p>No checkpoints yet</p>
            </div>
          ) : (
            <DataTable<Checkpoint>
              loading={loading}
              keyField="id"
              rows={checkpoints}
              emptyMessage="No checkpoints"
              columns={[
                {
                  key: 'code',
                  label: 'Code',
                  render: (r) => (
                    <span className="font-mono text-sm">{r.code}</span>
                  ),
                },
                { key: 'name', label: 'Name' },
                {
                  key: 'siteId',
                  label: 'Site',
                  render: (r) => (
                    <span className="text-xs text-[#605e5c]">
                      {r.siteCode && r.siteName
                        ? `${r.siteCode} — ${r.siteName}`
                        : siteLabel(r.siteId)}
                    </span>
                  ),
                },
                {
                  key: 'zone',
                  label: 'Zone',
                  render: (r) => r.zone ?? '—',
                },
                {
                  key: 'qrCode',
                  label: 'QR / NFC',
                  render: (r) => (
                    <span className="font-mono text-[11px] text-[#605e5c]">
                      {r.qrCode ?? '—'}
                      {r.nfcTagId ? ` / ${r.nfcTagId}` : ''}
                    </span>
                  ),
                },
                {
                  key: 'isActive',
                  label: 'Status',
                  render: (r) => (
                    <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      ) : null}

      {section === 'scans' ? (
        <GlassCard className="!p-0 overflow-hidden">
          {scans.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
              <ScanLine className="h-5 w-5 text-[#a19f9d]" />
              <p>No patrol scans yet</p>
              <p className="max-w-sm text-xs">
                Scans come from Guard app (
                <code className="font-mono">POST /attendance/patrols/scan</code>
                ).
              </p>
            </div>
          ) : (
            <DataTable<PatrolScan>
              loading={loading}
              keyField="id"
              rows={scans}
              emptyMessage="No scans"
              columns={[
                {
                  key: 'scannedAt',
                  label: 'Scanned',
                  render: (r) => (
                    <span className="text-xs">{formatDateTime(r.scannedAt)}</span>
                  ),
                },
                {
                  key: 'checkpointName',
                  label: 'Checkpoint',
                  render: (r) => (
                    <span>
                      <span className="font-mono text-xs">
                        {r.checkpointCode ?? r.checkpoint?.code ?? '—'}
                      </span>
                      <span className="ml-1 text-[#605e5c]">
                        {r.checkpointName ?? r.checkpoint?.name ?? ''}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'siteId',
                  label: 'Site',
                  render: (r) => (
                    <span className="text-xs text-[#605e5c]">
                      {r.siteCode && r.siteName
                        ? `${r.siteCode} — ${r.siteName}`
                        : siteLabel(r.siteId)}
                    </span>
                  ),
                },
                {
                  key: 'method',
                  label: 'Method',
                  render: (r) => (
                    <StatusBadge status={r.method || 'UNKNOWN'} />
                  ),
                },
                {
                  key: 'guardId',
                  label: 'Guard',
                  render: (r) => (
                    <span className="font-mono text-[11px] text-[#605e5c]">
                      {shortId(r.guardId)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      ) : null}

      {createCpOpen ? (
        <CreateCheckpointModal
          sites={sites}
          defaultSiteId={siteId || sites[0]?.id || ''}
          onClose={() => setCreateCpOpen(false)}
          onCreated={async () => {
            setCreateCpOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {createRouteOpen ? (
        <CreateRouteModal
          sites={sites}
          checkpoints={checkpoints}
          defaultSiteId={siteId || sites[0]?.id || ''}
          onClose={() => setCreateRouteOpen(false)}
          onCreated={async () => {
            setCreateRouteOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </BranchShell>
  );
}

function CreateCheckpointModal({
  sites,
  defaultSiteId,
  onClose,
  onCreated,
}: {
  sites: Site[];
  defaultSiteId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [nfcTagId, setNfcTagId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const lat = latitude.trim() ? Number(latitude) : undefined;
      const lng = longitude.trim() ? Number(longitude) : undefined;
      if (latitude.trim() && Number.isNaN(lat)) {
        throw new Error('Latitude must be a number');
      }
      if (longitude.trim() && Number.isNaN(lng)) {
        throw new Error('Longitude must be a number');
      }
      await createCheckpoint({
        siteId,
        code: code.trim(),
        name: name.trim(),
        zone: zone.trim() || undefined,
        qrCode: qrCode.trim() || undefined,
        nfcTagId: nfcTagId.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create checkpoint" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Code
            <input
              className={`${inputCls} mt-1 font-mono`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CP-GATE-02"
              required
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Name
            <input
              className={`${inputCls} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Side Gate"
              required
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-[#605e5c]">
          Zone (optional)
          <input
            className={`${inputCls} mt-1`}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="PERIMETER"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            QR code (optional)
            <input
              className={`${inputCls} mt-1 font-mono`}
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Defaults to code"
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            NFC tag (optional)
            <input
              className={`${inputCls} mt-1 font-mono`}
              value={nfcTagId}
              onChange={(e) => setNfcTagId(e.target.value)}
              placeholder="NFC-…"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Latitude (optional)
            <input
              className={`${inputCls} mt-1 font-mono`}
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="-6.7924"
              inputMode="decimal"
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Longitude (optional)
            <input
              className={`${inputCls} mt-1 font-mono`}
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="39.2083"
              inputMode="decimal"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateRouteModal({
  sites,
  checkpoints,
  defaultSiteId,
  onClose,
  onCreated,
}: {
  sites: Site[];
  checkpoints: Checkpoint[];
  defaultSiteId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteCps = useMemo(
    () => checkpoints.filter((c) => c.siteId === siteId),
    [checkpoints, siteId],
  );

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => siteCps.some((c) => c.id === id)));
  }, [siteCps]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Select at least one checkpoint (order = click order)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPatrolRoute({
        siteId,
        name: name.trim(),
        checkpointIds: selected,
      });
      await onCreated();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New patrol route"
      description="Ordered checkpoint sequence. Click checkpoints in walk order."
      onClose={onClose}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        ) : null}
        <label className="block text-xs font-medium text-[#605e5c]">
          Site
          <select
            className={`${inputCls} mt-1`}
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setSelected([]);
            }}
            required
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#605e5c]">
          Route name
          <input
            className={`${inputCls} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Night perimeter loop"
            required
          />
        </label>
        <div>
          <p className="text-xs font-medium text-[#605e5c]">
            Checkpoints (order: {selected.length ? selected.length : 'none'})
          </p>
          {siteCps.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800">
              No checkpoints for this site — create some first.
            </p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[#e1dfdd] p-2">
              {siteCps.map((c) => {
                const idx = selected.indexOf(c.id);
                const on = idx >= 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                        on
                          ? 'bg-[#eff6fc] text-[#0067b8] ring-1 ring-[#c7e0f4]'
                          : 'hover:bg-[#faf9f8] text-[#323130]'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-white font-mono text-[10px] ring-1 ring-[#e1dfdd]">
                        {on ? idx + 1 : '·'}
                      </span>
                      <span className="font-mono font-semibold">{c.code}</span>
                      <span className="text-[#605e5c]">{c.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selected.length > 0 ? (
            <p className="mt-1 font-mono text-[11px] text-[#8a8886]">
              {selected
                .map((id) => siteCps.find((c) => c.id === id)?.code)
                .filter(Boolean)
                .join(' → ')}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Create route'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
