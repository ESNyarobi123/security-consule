'use client';

import type { Device } from '@pssms/api-client';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import {
  WALL,
  deviceTypeMeta,
  formatWhen,
  relativeTime,
  statusTone,
} from './shared';

export function DeviceDetailDrawer({
  device,
  siteLabel,
  gatewayLabel,
  onClose,
}: {
  device: Device;
  siteLabel?: string;
  gatewayLabel?: string;
  onClose: () => void;
}) {
  const tone = statusTone(device.status);
  const meta = deviceTypeMeta(device.type);
  const Icon = meta.Icon;
  const isCctv = device.type === 'CCTV_CAMERA';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{
          background: `linear-gradient(180deg, ${WALL.bgSoft} 0%, ${WALL.bg} 100%)`,
          borderLeft: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <header
          className="flex items-start justify-between gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ring-2 ring-white/10"
              style={{
                background:
                  'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
              }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {device.name}
              </p>
              <p
                className="mt-0.5 font-mono text-xs"
                style={{ color: WALL.muted }}
              >
                {device.code}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${tone.className}`}
                >
                  {tone.label}
                </span>
                <span className="inline-flex items-center rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200 ring-1 ring-sky-400/25">
                  {meta.short}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid gap-3">
            {[
              ['Connection', device.connection],
              ['Vendor', device.vendor],
              ['Model', device.model],
              ['Serial', device.serialNumber],
              ['Site', siteLabel || device.siteId],
              ['Edge gateway', gatewayLabel || device.edgeGatewayId],
              ['Last seen', relativeTime(device.lastSeenAt)],
              ['Created', formatWhen(device.createdAt)],
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

        <footer
          className="flex flex-wrap gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${WALL.border}` }}
        >
          <Link
            href={`/devices/${device.id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2.5 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
          >
            Full device page
          </Link>
          {isCctv ? (
            <Link
              href="/cctv"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <ExternalLink className="h-4 w-4" />
              CCTV wall
            </Link>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
