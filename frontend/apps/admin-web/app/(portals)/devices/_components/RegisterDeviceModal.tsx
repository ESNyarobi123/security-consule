'use client';

import {
  DEVICE_CONNECTIONS,
  DEVICE_TYPES,
  registerDevice,
  type DeviceConnection,
  type DeviceType,
  type EdgeGateway,
  type Site,
} from '@pssms/api-client';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { FormEvent, useState } from 'react';
import { formatDeviceType } from './shared';

export function RegisterDeviceModal({
  gateways,
  sites,
  onClose,
  onCreated,
}: {
  gateways: EdgeGateway[];
  sites: Site[];
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
  const [vendor, setVendor] = useState('');
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
        vendor: vendor.trim() || undefined,
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
    <Modal
      title="New device"
      description="Register a field device — biometrics, scanners, printers, RFID, or CCTV camera metadata."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#323130]">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputCls}
              placeholder="FP-HQ-01"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Reception Fingerprint"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className={inputCls}
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatDeviceType(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Connection
            <select
              value={connection}
              onChange={(e) =>
                setConnection(e.target.value as DeviceConnection)
              }
              className={inputCls}
            >
              {DEVICE_CONNECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Edge gateway{' '}
            <span className="font-normal text-[#605e5c]">(USB devices)</span>
            <select
              value={edgeGatewayId}
              onChange={(e) => setEdgeGatewayId(e.target.value)}
              className={inputCls}
            >
              <option value="">— none —</option>
              {gateways.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Serial number{' '}
            <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className={inputCls}
              placeholder="for iClock/ADMS terminals"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Vendor <span className="font-normal text-[#605e5c]">(optional)</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className={inputCls}
              placeholder="ZKTeco, Hikvision…"
            />
          </label>
          <label className="block text-sm font-medium text-[#323130]">
            Site <span className="font-normal text-[#605e5c]">(optional)</span>
            {sites.length > 0 ? (
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className={inputCls}
              >
                <option value="">— none —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className={inputCls}
                placeholder="site UUID"
              />
            )}
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-[#323130]">
          <input
            type="checkbox"
            checked={directPush}
            onChange={(e) => setDirectPush(e.target.checked)}
          />
          Issue a direct device API key (network terminals that push on their
          own)
        </label>
        {type === 'CCTV_CAMERA' ? (
          <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
            CCTV cameras store registry + embed/snapshot URLs only — video never
            streams through Nest. Manage the mosaic on{' '}
            <strong>/cctv</strong>.
          </p>
        ) : null}
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
            {submitting ? 'Registering…' : 'Register device'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
