'use client';

import {
  registerDevice,
  type Device,
  type DeviceConnection,
  type Site,
} from '@pssms/api-client';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { FormEvent, useState } from 'react';
import { CCTV_CONNECTIONS } from './shared';

export function ConnectCameraModal({
  sites,
  onClose,
  onCreated,
}: {
  sites: Site[];
  onClose: () => void;
  onCreated: (device: Device) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [vendor, setVendor] = useState('');
  const [connection, setConnection] =
    useState<(typeof CCTV_CONNECTIONS)[number]>('ONVIF');
  const [streamUrl, setStreamUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [zone, setZone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {};
      if (streamUrl.trim()) config.streamUrl = streamUrl.trim();
      if (embedUrl.trim()) config.embedUrl = embedUrl.trim();
      if (snapshotUrl.trim()) config.snapshotUrl = snapshotUrl.trim();
      if (zone.trim()) config.zone = zone.trim();

      const device = await registerDevice({
        code: code.trim(),
        name: name.trim(),
        type: 'CCTV_CAMERA',
        connection: connection as DeviceConnection,
        siteId: siteId || undefined,
        vendor: vendor.trim() || undefined,
        config: Object.keys(config).length ? config : undefined,
      });
      onCreated(device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register camera');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Connect camera"
      description="Works with Hikvision, Dahua, Uniview, Axis, and any ONVIF NVR. Paste the NVR web-view / embed URL reachable from this browser — video stays on your NVR, not Nest."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
          Hosted PSSMS on your server registers the camera + stores URLs. Operators
          open tiles that load the NVR page directly (same network / VPN / public
          NVR HTTPS as you configure).
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#605e5c]">
            Code *
            <input
              required
              className={inputCls}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CAM-GATE-01"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Name *
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main gate camera"
            />
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Site
            <select
              className={inputCls}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">— Select site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Vendor
            <select
              className={inputCls}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            >
              <option value="">— Select / other —</option>
              <option value="Hikvision">Hikvision</option>
              <option value="Dahua">Dahua</option>
              <option value="Uniview">Uniview</option>
              <option value="Axis">Axis</option>
              <option value="ONVIF">ONVIF generic</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            Connection *
            <select
              className={inputCls}
              value={connection}
              onChange={(e) =>
                setConnection(e.target.value as (typeof CCTV_CONNECTIONS)[number])
              }
            >
              {CCTV_CONNECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[#605e5c]">
            NVR channel / zone
            <input
              className={inputCls}
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Ch 3 · West perimeter"
            />
          </label>
        </div>

        <div className="rounded-md border border-[#e1dfdd] bg-[#faf9f8] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
            Stream metadata (http/https only)
          </p>
          <div className="mt-2 grid gap-3">
            <label className="block text-xs font-medium text-[#605e5c]">
              Embed URL
              <input
                className={inputCls}
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://nvr.example/embed/…"
                type="url"
              />
            </label>
            <label className="block text-xs font-medium text-[#605e5c]">
              Stream URL
              <input
                className={inputCls}
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://… (fallback if no embed)"
                type="url"
              />
            </label>
            <label className="block text-xs font-medium text-[#605e5c]">
              Snapshot URL
              <input
                className={inputCls}
                value={snapshotUrl}
                onChange={(e) => setSnapshotUrl(e.target.value)}
                placeholder="https://…/snapshot.jpg"
                type="url"
              />
            </label>
          </div>
        </div>

        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect camera'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
