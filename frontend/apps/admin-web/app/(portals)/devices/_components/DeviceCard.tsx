'use client';

import type { Device } from '@pssms/api-client';
import { Cable, Clock, ExternalLink, Factory } from 'lucide-react';
import Link from 'next/link';
import {
  WALL,
  deviceTypeMeta,
  isDeviceOnline,
  relativeTime,
  statusTone,
} from './shared';

export function DeviceCard({
  device,
  siteLabel,
  onOpen,
}: {
  device: Device;
  siteLabel?: string;
  onOpen: (d: Device) => void;
}) {
  const online = isDeviceOnline(device.status);
  const tone = statusTone(device.status);
  const meta = deviceTypeMeta(device.type);
  const Icon = meta.Icon;
  const isCctv = device.type === 'CCTV_CAMERA';

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl transition duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: `linear-gradient(160deg, ${WALL.panel} 0%, #0d1f35 100%)`,
        border: `1px solid ${online ? 'rgba(52, 211, 153, 0.35)' : WALL.borderStrong}`,
      }}
    >
      {online ? (
        <span
          className="absolute right-3 top-3 flex h-2.5 w-2.5"
          title="Online"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onOpen(device)}
        className="flex flex-1 flex-col px-4 pb-3 pt-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-inner ring-2 ring-white/10"
            style={{
              background: online
                ? 'linear-gradient(145deg, #34d399 0%, #0e7490 55%, #0078d4 100%)'
                : 'linear-gradient(145deg, #38bdf8 0%, #0078d4 55%, #0e7490 100%)',
            }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pr-4">
            <p className="truncate text-sm font-semibold text-white">
              {device.name}
            </p>
            <p
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: WALL.muted }}
            >
              {device.code}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

        <div
          className="mt-3 space-y-1.5 text-[12px]"
          style={{ color: WALL.muted }}
        >
          <p className="flex items-center gap-1.5 truncate">
            <Cable className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {device.connection}
            {siteLabel ? ` · ${siteLabel}` : ''}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Last seen {relativeTime(device.lastSeenAt)}
          </p>
          {device.vendor ? (
            <p className="flex items-center gap-1.5 truncate">
              <Factory className="h-3.5 w-3.5 shrink-0 opacity-70" />
              {device.vendor}
              {device.model ? ` · ${device.model}` : ''}
            </p>
          ) : null}
        </div>
      </button>

      <div
        className="flex flex-wrap gap-1.5 px-3 py-2.5"
        style={{ borderTop: `1px solid ${WALL.border}` }}
      >
        <Link
          href={`/devices/${device.id}`}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-sky-400/15 px-2 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-400/25"
        >
          Open detail
        </Link>
        {isCctv ? (
          <Link
            href="/cctv"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-teal-400/15 px-2 py-1.5 text-[11px] font-semibold text-teal-200 transition hover:bg-teal-400/25"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open CCTV wall
          </Link>
        ) : null}
      </div>
    </article>
  );
}
