'use client';

import {
  createCheckpoint,
  listCheckpoints,
  listPatrolScans,
  listSites,
  type Checkpoint,
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
import { MapPinned, Plus, RefreshCw, ScanLine } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDateTime, shortId } from '../_components/shared';

type Section = 'checkpoints' | 'scans';

export default function BranchPatrolsPage() {
  const [section, setSection] = useState<Section>('checkpoints');
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [scans, setScans] = useState<PatrolScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const siteList = await listSites();
      setSites(siteList);
      const filter = siteId || undefined;
      const [cps, ps] = await Promise.all([
        listCheckpoints(filter),
        listPatrolScans(filter),
      ]);
      setCheckpoints(cps);
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

  return (
    <BranchShell
      title="Patrols"
      description="Configure site checkpoints (QR/NFC/GPS) and review recent patrol scans. Route builder, GPS map, and missed-patrol alerts are deferred."
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
          {section === 'checkpoints' ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={btnPrimary}
              disabled={sites.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              New checkpoint
            </button>
          ) : null}
        </>
      }
    >
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
      </div>

      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
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
      ) : (
        <GlassCard className="!p-0 overflow-hidden">
          {scans.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[#605e5c]">
              <ScanLine className="h-5 w-5 text-[#a19f9d]" />
              <p>No patrol scans yet</p>
              <p className="max-w-sm text-xs">
                Scans are recorded from the guard / field path (
                <code className="font-mono">POST /attendance/patrols/scan</code>
                ). Admin UI is list-only.
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
      )}

      {createOpen ? (
        <CreateCheckpointModal
          sites={sites}
          defaultSiteId={siteId || sites[0]?.id || ''}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
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
